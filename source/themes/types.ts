// src/themes/types.ts
export interface ThemeColors {
	// Primary UI colors
	primary: string; // Main accent color
	secondary: string; // Secondary accent color

	// Text colors
	text: string; // Regular text
	dimText: string; // Secondary, less important text
	highlightText: string; // Important text

	// Background colors
	background: string; // Main background
	panel: string; // Panel/card background

	// State colors
	success: string; // Success states
	error: string; // Error states
	warning: string; // Warning states
	info: string; // Info states

	// UI element colors
	border: string; // Borders
	selection: string; // Selected items
}

export interface Theme {
	name: string;
	colors: ThemeColors;
}
