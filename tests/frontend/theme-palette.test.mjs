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
    return reference ? color(reference[1]) : value;
}

function luminance(hex) {
    assert.match(hex, /^#[\da-f]{6}$/i);
    const channels = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
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
        'surface-selected': 'veiled-vista', 'surface-info': 'baltic-sea',
        'surface-attention': 'golden-mist', 'surface-group': 'quiet-violet',
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
        'shadow-sm': '0 1px 2px 0 rgba(117, 111, 107, 0.08)',
        'shadow-md': '0 4px 6px -1px rgba(117, 111, 107, 0.12)',
        'shadow-lg': '0 10px 15px -3px rgba(117, 111, 107, 0.16)',
        'elevation-overlay': '0 8px 24px rgba(15, 23, 42, 0.14)'
    })) assert.equal(tokens[`--${role}`], value, role);
});

test('normal text meets unrounded WCAG AA contrast on its intended surfaces', () => {
    const pairs = [
        ['--text', '--surface'], ['--text', '--page'], ['--text-muted', '--page'],
        ['--text-muted', '--surface'], ['--text-palette', '--page'],
        ['--text-muted', '--surface-calm'], ['--text-muted', '--surface-selected'],
        ['--text-muted', '--surface-attention'],
        ['--text-palette', '--surface-selected'], ['--surface', '--action'],
        ['--surface', '--action-hover'], ['--surface', '--action-active'],
        ['--surface', '--action-secondary'], ['--surface', '--action-secondary-hover'],
        ['--text', '--surface-info'], ['--text', '--surface-attention'],
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
        ['--focus-inverse', '--action'], ['--focus-inverse', '--action-secondary']
    ]) assert.ok(contrast(foreground, background) >= 3, `${foreground} on ${background}`);
});
