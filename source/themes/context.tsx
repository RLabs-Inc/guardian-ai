// src/themes/context.tsx
import React, {createContext, useContext, useState} from 'react';
import {Theme} from './types.js';
import {darkTheme} from './definitions/dark.js';
import {lightTheme} from './definitions/light.js';
import {TerminalDefaultTheme} from './terminalColors.js';

// Default themes
const themes: Theme[] = [darkTheme, lightTheme, TerminalDefaultTheme];

type ThemeContextType = {
	currentTheme: Theme;
	setTheme: (themeName: string) => void;
	availableThemes: string[];
};

const ThemeContext = createContext<ThemeContextType>({
	currentTheme: themes[0]!,
	setTheme: () => {},
	availableThemes: themes.map(t => t.name),
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
	children,
}) => {
	const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]!);

	const setTheme = (themeName: string) => {
		const theme = themes.find(t => t.name === themeName);
		if (theme) {
			setCurrentTheme(theme);
		}
	};

	return (
		<ThemeContext.Provider
			value={{
				currentTheme,
				setTheme,
				availableThemes: themes.map(t => t.name),
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => useContext(ThemeContext);
