// Hermes does not provide Intl.PluralRules, which the Sui client uses at module load.
require('@formatjs/intl-pluralrules/polyfill-force.js');
require('@formatjs/intl-pluralrules/locale-data/en.js');
require('expo-router/entry');
