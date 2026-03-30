build-OrderHandlerFunction:
	npm install
	npm run build
	mkdir -p "$(ARTIFACTS_DIR)"
	cp package.json "$(ARTIFACTS_DIR)/package.json"
	cp -r dist "$(ARTIFACTS_DIR)/dist"
