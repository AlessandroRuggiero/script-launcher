import { App, Editor, FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';

interface Script {
	path: string;
	name: string;
	icon?: string;
	showOnBottomBar?: boolean;
	showExitCode?: boolean;
	runOnStartup?: boolean;
}


export default class ScriptLauncher extends Plugin {
	scripts: Array<Script> = [];
	barElements: Array<HTMLElement> = [];
	verifiedScripts: Set<string> = new Set<string>();  // scripts we already know exist (is a cache so we do not have to hit the OS every single change)
	runningScriptsToStop: Map<number, ChildProcess> = new Map<number, ChildProcess>();  // map of process id to script

	async onload() {
		await this.loadSettings();
		this.createIcons();
		this.addSettingTab(new ScriptLauncherSettingTab(this.app, this));

		for (const script of this.scripts) {
			if (script.runOnStartup) {
				this.runScript(script);
			}
		}

		//adding the command to run any script at any time
		this.addCommand({
			id: 'run-script',
			name: 'Run script',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new ScriptSelectionModal(this).open()
			}
		});
	}

	onunload() {
		for (const [, childProcess] of this.runningScriptsToStop) {
			childProcess.kill();
		}
	}

	exists(path: string): boolean {
		try {
			return fs.lstatSync(path).isFile();
		} catch (e) {
			return false;
		}
	}

	createIcons() {
		for (const el of this.barElements) {
			el.remove();
		}
		for (const script of this.scripts) {
			if (!script.showOnBottomBar) continue;
			// check if the path esists
			if (!(this.verifiedScripts.has(script.path)) && !this.exists(script.path)) continue;
			this.verifiedScripts.add(script.path);
			const statusBarItemEl = this.addStatusBarItem();
			statusBarItemEl.setText(script.icon ?? script.name);
			statusBarItemEl.onClickEvent((_) => {
				this.runScript(script);
			})
			this.barElements.push(statusBarItemEl);
		}
	}

	async loadSettings() {
		let scripts = await this.loadData();
		if (!scripts) scripts = [];
		this.scripts = scripts;
	}

	async saveSettings() {
		await this.saveData(this.scripts);
	}



	runScript(script: Script) {
		const childProcess = spawn(script.path, [this.getVaultPath() ?? "", this.getFilePath() ?? ""], { shell: true });
		if (!childProcess.pid) {
			new Notice(`Failed to start script: ${script.name}`);
			return;
		}
		const pid = childProcess.pid;
		childProcess.stdout.on("data", (data: any) => {
			console.log(`stdout: ${data}`);
			new Notice(data);
		});

		childProcess.stderr.on("data", (data: any) => {
			console.log(`stderr: ${data}`);
			new Notice(data);
		});

		childProcess.on('error', (error: Error) => {
			new Notice(`error: ${error}`);
		});
		if (script.showExitCode) {
			childProcess.on("close", (code: any) => {
				new Notice(`child process exited with code ${code}`);
			});
		}
		this.runningScriptsToStop.set(pid, childProcess);
		childProcess.on("exit", (code: any) => {
			this.runningScriptsToStop.delete(pid);
		});
	}

	getVaultPath() {
		const adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return null;
	}

	getFilePath() {
		return app.workspace.getActiveFile()?.path;
	}
}

class ScriptLauncherSettingTab extends PluginSettingTab {
	plugin: ScriptLauncher;

	constructor(app: App, plugin: ScriptLauncher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.createSettings();
	}

	async onSettingsChange() {
		this.plugin.createIcons();
		await this.plugin.saveSettings();
	}

	createSettings() {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Script Launcher Settings' });
		for (let i = 0; i < this.plugin.scripts.length; i++) {
			const script = this.plugin.scripts[i];

			new Setting(containerEl)
				.setName("========= Script " + i + " =========");

			new Setting(containerEl)
				.setName("Script name")
				.addText(text => text
					.setPlaceholder("Unnamed")
					.setValue(script.name)
					.onChange(async (value) => {
						script.name = value;
						await this.onSettingsChange()
					}))
			new Setting(containerEl)
				.setName("Script path")
				.addText(text => text
					.setPlaceholder("path to file")
					.setValue(script.path)
					.onChange(async (value) => {
						script.path = value;
						await this.onSettingsChange()
					}))
				.addButton(button => button
					.setButtonText("Browse")
					.onClick(() => {
						const input = document.createElement('input');
						input.type = 'file';
						input.style.display = 'none';
						document.body.appendChild(input);
						
						input.onchange = async (e: Event) => {
							const file = (e.target as HTMLInputElement).files?.[0];
							if (file) {
								let filePath = (file as any).path;
								// In some Electron setups (like Flatpak/Snap), .path is hidden for security
								// We can try to retrieve it using Electron's webUtils
								if (!filePath) {
									try {
										// eslint-disable-next-line @typescript-eslint/no-var-requires
										filePath = require('electron').webUtils.getPathForFile(file);
									} catch (err) {
										console.error(err);
									}
								}
								
								if (filePath) {
									script.path = filePath;
									await this.onSettingsChange();
									this.createSettings();
								} else {
									new Notice(`Could not get absolute path for: ${file.name}`);
								}
							}
							document.body.removeChild(input);
						};
						input.click();
					}));
			new Setting(containerEl)
				.setName("Show on bottom bar")
				.addToggle((toggle) => {
					toggle.setValue(script.showOnBottomBar ?? false)
						.onChange(async (v) => {
							script.showOnBottomBar = v;
							await this.onSettingsChange()
						})
				})
			new Setting(containerEl)
				.setName("Run on startup")
				.addToggle((toggle) => {
					toggle.setValue(script.runOnStartup ?? false)
						.onChange(async (v) => {
							script.runOnStartup = v;
							await this.onSettingsChange()
						})
				})
			new Setting(containerEl)
				.setName("Show exit code")
				.addToggle((toggle) => {
					toggle.setValue(script.showExitCode ?? false)
						.onChange(async (v) => {
							script.showExitCode = v;
							await this.onSettingsChange()
						})
				}
				)

			new Setting(containerEl)
				.setName("Icon")
				.addText(text => text
					.setPlaceholder("icon")
					.setValue(script.icon ?? "")
					.onChange(async (value) => {
						script.icon = value;
						await this.onSettingsChange()
					}));
			new Setting(containerEl)
				.setName("Delete")
				.addButton((button) => {
					button.setIcon("trash")
						.onClick(async (evt) => {
							this.plugin.scripts.remove(script);
							this.createSettings();
							await this.onSettingsChange()
						})
				})
				;

		}
		new Setting(containerEl)
			.setName("Add Script")
			.addButton((button) => button.setIcon("plus-with-circle")
				.onClick(async (evt) => {
					this.plugin.scripts.push({
						name: "Unnamed",
						path: ""
					})
					await this.plugin.saveSettings();
					this.createSettings();
				})
			)

	}
}

class ScriptSelectionModal extends SuggestModal<Script> {
	plugin: ScriptLauncher;

	constructor(plugin: ScriptLauncher) {
		super(plugin.app);
		this.plugin = plugin;
	}
	// Returns all available suggestions.
	getSuggestions(query: string): Script[] {
		return this.plugin.scripts.filter((script: Script) =>
			script.name.toLowerCase().includes(query.toLowerCase())
		);
	}

	// Renders each suggestion item.
	renderSuggestion(script: Script, el: HTMLElement) {
		el.createEl("div", { text: script.name });
	}

	// Perform action on the selected suggestion.
	onChooseSuggestion(script: Script, evt: MouseEvent | KeyboardEvent) {
		this.plugin.runScript(script);
	}



}