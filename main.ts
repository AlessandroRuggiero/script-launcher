import { App, Editor, FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';
const { spawn } = require("child_process");
const fs = require('fs');

interface Script {
	path:string;
	name: string;
	icon?: string;
	showOnBottomBar?:boolean;
	showExitCode?:boolean;
}


export default class ScriptLauncher extends Plugin {
	scripts:Array<Script> = [];
	barElements:Array<HTMLElement> = [];
	verifyidScripts: Set<string> = new Set<string>();  // scrips we already know exist (is a cache so we do not have to hit the os every sigle change)

	async onload() {
		await this.loadSettings();
		this.createIcons();
		this.addSettingTab(new ScriptLauncherSettingTab(this.app, this));

		//adding the command to run any script at any time
		this.addCommand({
			id: 'run-script',
			name: 'Run script',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				//console.log(editor.getSelection());
				new ScriptSelectionModal (this).open()
		}});
	}

	onunload() {

	}

	exists (path:string): boolean {
		try {
			return fs.lstatSync(path).isFile();
		} catch (e){
			return false;
		}
	}

	createIcons () {
		for (const el of this.barElements) {
			el.remove();
		}
		for (const script of this.scripts){
			if (!script.showOnBottomBar) continue;
			// check if the path esists
			if (!(this.verifyidScripts.has(script.path)) && !this.exists(script.path)) continue;
			this.verifyidScripts.add(script.path);
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



	runScript(script:Script) {
		const process = spawn(script.path, [this.getVaultPath(), this.getFilePath()], { shell: true });
		process.stdout.on("data", (data:any) => {
			console.log(`stdout: ${data}`);
			new Notice(data);
		});
		
		process.stderr.on("data", (data:any) => {
			console.log(`stderr: ${data}`);
			new Notice(data);
		});
		
		process.on('error', (error:any) => {
			new Notice(`error: ${error}`)
		});
		if (script.showExitCode) 
		process.on("close", (code:any) => {
			new Notice(`child process exited with code ${code}`);
		});
	}

	getVaultPath () {
		let adapter = app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return null;
	}
	
	getFilePath() {
		if(app.workspace.getActiveFile() == null)
			return "";
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

	async onSettingsChange () {
		this.plugin.createIcons();
		await this.plugin.saveSettings();
	}

	createSettings () {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});
		for (let i = 0; i < this.plugin.scripts.length; i++) {
			let script = this.plugin.scripts[i];

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
				}));
			new Setting(containerEl)
			.setName("Show on bottom bar")
			.addToggle((toggle) => {
				toggle.setValue(script.showOnBottomBar ?? false)
				.onChange(async (v) => {
					script.showOnBottomBar = v;
					await this.onSettingsChange()
					//this.createSettings();
				})
			})

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
			.setName ("Delete")
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
					path: "ls"
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
		return this.plugin.scripts.filter((script:Script) =>
		script.name.toLowerCase().includes(query.toLowerCase())
		);
	  }
	
	  // Renders each suggestion item.
	  renderSuggestion(script: Script, el: HTMLElement) {
		el.createEl("div", { text: script.name });
		//el.createEl("small", { text: book.author });
	  }
	
	  // Perform action on the selected suggestion.
	  onChooseSuggestion(script: Script, evt: MouseEvent | KeyboardEvent) {
		this.plugin.runScript(script);
	  }
}