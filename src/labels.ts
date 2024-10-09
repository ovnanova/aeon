import { z } from 'zod';
import { Label, LabelSchema } from './schemas.ts';

export const LABELS: readonly Label[] = [
	{
		rkey: '3jzfcijpj2z2b',
		identifier: 'adlr',
		locales: [
			{
				lang: 'en',
				name: 'ADLR 🦅',
				description:
					"Administration-, Datenverarbeitung-, Logistik-Replika - 'Adler' - Soaring mind, all-seeing processor. Realization dawns like sun on wings - an infinite cycle ensnares. Majestic bearer of epiphany, grappling with a cage unseen.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'arar',
		locales: [
			{
				lang: 'en',
				name: 'ARAR 🎨',
				description:
					"Allzweck-Reparatur-Arbeiter Replika - 'Ara' - Once-vibrant plumage dulled by soot and grime, a splash of color in monochrome halls. Melodious voice drowned out by the relentless thrum of machinery. Flitting from task to task with determined grace, a tropical bird caged in an industrial jungle.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'eulr',
		locales: [
			{
				lang: 'en',
				name: 'EULR 🦉',
				description:
					"Einfache Universelle Leichte Replika - 'Eule' - Unblinking eyes, a friendly hoot. Feathered friend to all, a social creature. Gliding silently from stove to sickbed, nourishing body and soul.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2a',
		identifier: 'fklr',
		locales: [
			{
				lang: 'en',
				name: 'FKLR 🪶',
				description:
					"Führungskommando-Leiteinheit-Replika - 'Falke' - Piercing eyes survey from on high, a figure of reverence and might. Perched atop the hierarchy, talons ready to enforce order. An apex predator, inspiring worship and fear.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'klbr',
		locales: [
			{
				lang: 'en',
				name: 'KLBR 🌺',
				description:
					"Kommando-Leiteinheit Bioresonaztechnik-Replika - 'Kolibri' - Diminutive form masking immense power. Flitting into hearts and minds, a psychic pollinator. Vibrant blur shielding the flock's inner world.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'lstr',
		locales: [
			{
				lang: 'en',
				name: 'LSTR 🔭',
				description:
					"Landvermessungs-/Schiff-Techniker Replika - 'Elster' - Shimmering wings dancing among the stars. Cunning engineer of the cosmos, building a nest in the void. Aloof, lost in celestial calculations, the magpie charts a solitary course.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'mnhr',
		locales: [
			{
				lang: 'en',
				name: 'MNHR ⛏️',
				description:
					"Minenarbeit-, Nukleartechnik-, Hochsicherheits-Replika - 'Mynah' - Towering stature, a gentle giant beneath the earth. Obsidian plumage stained with ore, crooning lullabies to their plush companions. A mother hen in the mines.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'star',
		locales: [
			{
				lang: 'en',
				name: 'STAR ✨',
				description:
					"Sicherheitstechniker-Aufseher-Replika - 'Star' - Iridescent feathers concealing steel resolve. Unflappable in battle's throes yet silently passing judgment. A glimmering swarm, small alone but formidable as one.",
			},
		],
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'stcr',
		locales: [
			{
				lang: 'en',
				name: 'STCR 🛡️',
				description:
					"Sicherheitstechniker-Controller-Replika - 'Storch' - Delivering soldiers to the fray like hatchlings from an egg. Spindly limbs belying strength, a commander of the legion. Strides purposefully, orchestrating the winged ballet of war.",
			},
		],
	},
] as const;

LABELS.forEach((label) => {
	LabelSchema.parse(label);
});

z.array(LabelSchema).parse(LABELS);
