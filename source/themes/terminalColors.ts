// src/themes/terminalColors.ts
import {Theme} from './types.js';

// Function to use terminal's default color scheme
export const TerminalDefaultTheme: Theme = {
	name: 'Terminal Default',
	colors: {
		primary: 'blue',
		secondary: 'cyan',
		text: 'white',
		dimText: 'gray',
		highlightText: 'white', // We'll use the bold prop separately
		background: '', // Use terminal default
		panel: 'black',
		success: 'green',
		error: 'red',
		warning: 'yellow',
		info: 'blue',
		border: 'gray',
		selection: 'blue',
	},
};
