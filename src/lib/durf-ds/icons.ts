import { icons } from '@lucide/svelte';
import type { Component } from 'svelte';

export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const KEBAB_TO_PASCAL = new Map<string, string>(
  Object.keys(icons).map((pascal) => [pascalToKebab(pascal), pascal])
);

export function kebabToPascal(name: string): string | undefined {
  return KEBAB_TO_PASCAL.get(name);
}

export const ALL_ICON_NAMES: string[] = [...KEBAB_TO_PASCAL.keys()].sort();

export function filterIconNames(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...names];
  return names.filter((n) => n.includes(q));
}

export function getIconComponent(kebabName: string): Component | undefined {
  const pascal = kebabToPascal(kebabName);
  if (!pascal) return undefined;
  return (icons as Record<string, Component>)[pascal];
}
