import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../../assets/css/styles.css', import.meta.url), 'utf8');
const root = css.match(/:root\s*\{([^}]+)\}/)?.[1] || '';
const declarations = [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)];
const tokens = Object.fromEntries(declarations.map(([, name, value]) => [name, value.trim().toLowerCase()]));
const palette = {
    'cloud-dancer': '#f0eee9', 'veiled-vista': '#c7e2c8', 'baltic-sea': '#7ab6d9',
    'golden-mist': '#d5cd94', 'quiet-violet': '#a693ac', 'cloud-cover': '#999393',
    hematite: '#756f6b', 'blue-fusion': '#496275'
};

function color(name) {
    const value = tokens[name];
    assert.ok(value, `Missing token ${name}`);
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    if (reference) return color(reference[1]);
    const mix = value.match(/^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/);
    if (mix) {
        const first = color(mix[1]);
        const second = color(mix[3]);
        const proportion = Number(mix[2]) / 100;
        return first.map((channel, index) => channel * proportion + second[index] * (1 - proportion));
    }
    const translucent = value.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
    if (translucent) {
        const surface = color('--surface');
        const opacity = Number(translucent[4]);
        return translucent.slice(1, 4).map((channel, index) => Number(channel) * opacity + surface[index] * (1 - opacity));
    }
    assert.match(value, /^#[\da-f]{6}$/i, name);
    return value.slice(1).match(/../g).map(channel => parseInt(channel, 16));
}

function luminance(rgb) {
    const channels = rgb.map(channel => channel / 255);
    const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
    const values = [luminance(color(first)), luminance(color(second))].sort((a, b) => a - b);
    return (values[1] + 0.05) / (values[0] + 0.05);
}

test('the eight approved swatches have one canonical declaration', () => {
    assert.equal(declarations.length, new Set(declarations.map(([, name]) => name)).size, 'Duplicate root tokens');
    assert.equal(Object.keys(tokens).filter(name => name.startsWith('--palette-')).length, 8);
    for (const [name, hex] of Object.entries(palette)) {
        assert.equal(tokens[`--palette-${name}`], hex);
        assert.equal(css.toLowerCase().split(hex).length - 1, 1, `${hex} must occur once`);
    }
});

test('semantic surfaces and interactions retain their approved palette roles', () => {
    const roles = {
        page: 'cloud-dancer', 'surface-subdued': 'cloud-dancer', 'surface-calm': 'veiled-vista',
        'surface-disabled': 'cloud-cover', 'text-palette': 'blue-fusion', action: 'blue-fusion',
        'action-secondary': 'hematite', focus: 'blue-fusion'
    };
    for (const [role, swatch] of Object.entries(roles)) {
        assert.equal(tokens[`--${role}`], `var(--palette-${swatch})`);
    }
    for (const [role, value] of Object.entries({
        surface: '#ffffff', text: '#0f172a', 'text-muted': '#475569', 'border-control': '#768894',
        'action-hover': '#354c5e', 'action-active': '#2b3e4d', 'action-secondary-hover': '#5d5855',
        'focus-inverse': '#ffffff', success: '#15803d', danger: '#b91c1c', warning: '#92400e',
        'surface-success': '#dcfce7', 'surface-danger': '#fee2e2', 'surface-warning': '#fef3c7'
    })) assert.equal(tokens[`--${role}`], value, role);
    for (const [role, value] of Object.entries({
        'border-subtle': 'rgba(117, 111, 107, 0.28)',
        'elevation-flat': 'none',
        'elevation-overlay': '0 8px 24px rgba(15, 23, 42, 0.14)'
    })) assert.equal(tokens[`--${role}`], value, role);
});

test('workflow foundations follow the reviewed showcase rather than the old palette-only geometry', () => {
    const showcase = readFileSync(new URL('../../plans/kiwi-light-and-shadow-theme-palette-showcase.html', import.meta.url), 'utf8');
    const referenceDeclarations = Object.fromEntries([...showcase.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)]
        .map(([, name, value]) => [name, value.trim().toLowerCase()]));
    for (const name of ['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-8', 'space-12', 'control-height']) {
        assert.equal(tokens[`--${name}`], referenceDeclarations[`--${name}`], name);
    }
    const surfaces = {
        'surface-canvas': 'preview-canvas', 'surface-data': 'preview-data-surface',
        'surface-label': 'preview-label-surface', 'surface-selected': 'preview-selected-surface',
        'surface-info': 'preview-info-surface', 'surface-attention': 'preview-attention-surface',
        'surface-group': 'preview-workflow-surface'
    };
    for (const [role, reference] of Object.entries(surfaces)) {
        const recipe = referenceDeclarations[`--${reference}`]
            .replace(/var\(--(cloud-dancer|veiled-vista|baltic-sea|golden-mist|quiet-violet|blue-fusion)\)/g, 'var(--palette-$1)')
            .replace('var(--white)', 'var(--surface)');
        assert.equal(tokens[`--${role}`], recipe, role);
    }
    assert.equal(tokens['--elevation-flat'], 'none');
    for (const role of ['radius-sm', 'radius-md', 'radius-lg']) {
        assert.ok(['0px', '4px'].includes(tokens[`--${role}`]), role);
    }
});

test('normal text meets unrounded WCAG AA contrast on its intended surfaces', () => {
    const pairs = [
        ['--text', '--surface'], ['--text', '--page'], ['--text-muted', '--page'],
        ['--text-muted', '--surface'], ['--text-palette', '--page'],
        ['--text-muted', '--surface-calm'], ['--text-muted', '--surface-selected'],
        ['--text-muted', '--surface-attention'],
        ['--text-palette', '--surface-selected'], ['--surface', '--action'],
        ['--surface', '--action-hover'], ['--surface', '--action-active'],
        ['--action-secondary', '--surface'], ['--action-secondary-hover', '--surface-secondary-hover'],
        ['--action', '--surface-quiet-hover'],
        ['--text', '--surface-info'], ['--text', '--surface-attention'],
        ['--text', '--surface-choice-selected'],
        ['--text-muted', '--surface-info'], ['--text-muted', '--surface-data'],
        ['--text-muted', '--surface-group'], ['--text-muted', '--surface-canvas'],
        ['--text-palette', '--surface-selected'],
        ['--text', '--surface-group'], ['--text', '--surface-disabled'],
        ['--success', '--surface-success'], ['--danger', '--surface-danger'],
        ['--warning', '--surface-warning'], ['--success', '--surface'],
        ['--danger', '--surface'], ['--warning', '--surface'],
        ['--success-hover', '--page'], ['--success-hover', '--surface-selected']
    ];
    for (const [foreground, background] of pairs) {
        assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}: ${contrast(foreground, background)}`);
    }
});

test('availability labels remain readable on their operational badge colors', () => {
    for (const status of ['ready', 'busy', 'dnd', 'brb', 'away', 'offline', 'acw']) {
        const ratio = contrast(`--status-${status}-text`, `--status-${status}`);
        assert.ok(ratio >= 4.5, `${status} badge text: ${ratio}`);
    }
});

test('generated presentation uses semantic classes instead of inline color values', () => {
    for (const filename of [
        '../../templates/base/index.html.twig',
        '../../assets/js/app/slices/article-search-slice.js',
        '../../assets/js/app/slices/order.js',
        '../../assets/js/app/slices/contact-history-slice.js'
    ]) {
        const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /style=["'][^"']*(?:color|background)[^"']*(?:#[\da-f]{3,8}|rgba?\()/i, filename);
    }
});

test('control boundaries and light/inverse focus indicators meet non-text contrast', () => {
    for (const [foreground, background] of [
        ['--border-control', '--page'], ['--border-control', '--surface'],
        ['--focus', '--page'], ['--focus', '--surface'], ['--focus', '--surface-selected'],
        ['--focus', '--surface-choice-selected'],
        ['--focus-inverse', '--action'], ['--focus-inverse', '--action-secondary']
    ]) assert.ok(contrast(foreground, background) >= 3, `${foreground} on ${background}`);
});
