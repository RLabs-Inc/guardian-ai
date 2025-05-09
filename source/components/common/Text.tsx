// src/components/common/Text.tsx
import React from 'react';
import {Text as InkText} from 'ink';
import {useTheme} from '../../themes/context.js';

interface TextProps {
	variant?: 'default' | 'dim' | 'highlight' | 'error' | 'success';
	children: React.ReactNode;
	color?: string;
	bold?: boolean;
	dimColor?: boolean;
	marginTop?: number;
}

export const Text: React.FC<TextProps> = ({
	variant = 'default', 
	children, 
	color: propColor, 
	bold: propBold, 
	dimColor, 
	marginTop
}) => {
	const {currentTheme} = useTheme();

	// Map variant to color and style props
	let color;
	let bold = false;

	switch (variant) {
		case 'dim':
			color = currentTheme.colors.dimText;
			break;
		case 'highlight':
			color = currentTheme.colors.highlightText;
			bold = true;
			break;
		case 'error':
			color = currentTheme.colors.error;
			bold = true;
			break;
		case 'success':
			color = currentTheme.colors.success;
			bold = true;
			break;
		default:
			color = currentTheme.colors.text;
	}

	// Override with props if provided
	if (propColor !== undefined) {
		color = propColor;
	}
	
	if (propBold !== undefined) {
		bold = propBold;
	}
	
	// Apply dim color if requested
	if (dimColor) {
		color = typeof color === 'string' ? color : currentTheme.colors.dimText;
	}

	const style = marginTop ? { marginTop } : undefined;

	return (
		<InkText color={color} bold={bold} {...(style && { style })}>
			{children}
		</InkText>
	);
};
