// src/themes/loader.ts
import {Theme} from './types.js';
import {darkTheme} from './definitions/dark.js';
import {lightTheme} from './definitions/light.js';
import {TerminalDefaultTheme} from './terminalColors.js';
import fs from 'fs';
import path from 'path';

// Default themes
const builtInThemes: Theme[] = [darkTheme, lightTheme, TerminalDefaultTheme];

export function loadThemes(): Theme[] {
	// Start with built-in themes
	const themes = [...builtInThemes];

	// Check if user themes directory exists
	const userThemesDir = path.join(process.cwd(), 'themes', 'custom');

	try {
		if (fs.existsSync(userThemesDir)) {
			const files = fs.readdirSync(userThemesDir);

			// Look for YAML theme files
			const yamlFiles = files.filter(
				file => file.endsWith('.yaml') || file.endsWith('.yml'),
			);

			// Load each YAML theme
			// For simplicity, we're not implementing the actual YAML parsing here
			// You would use a library like js-yaml to parse these files
			console.log(`Found ${yamlFiles.length} custom themes`);

			// This is where you'd parse and validate each theme file
			// and add valid themes to the themes array
		}
	} catch (error) {
		console.error('Error loading custom themes:', error);
	}

	return themes;
}
