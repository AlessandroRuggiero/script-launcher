.PHONY: build build_and_copy

vault_path ?= "/home/alessandro/Documents/Testing"

build:
	@echo "Building..."
	npm run build

build_and_copy: build
	@echo "Copying..."
	@if [ -z "$(vault_path)" ]; then \
	    echo "vault_path is not set, it should be the path to the vault where you want to test the plugin"; \
	    exit 1; \
	fi
	mkdir -p $(vault_path)/.obsidian/plugins/script-launcher
	cp main.js styles.css manifest.json $(vault_path)/.obsidian/plugins/script-launcher/