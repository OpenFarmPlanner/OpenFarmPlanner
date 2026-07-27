/**
 * Tests for i18n configuration and functionality
 */

import { describe, it, expect } from 'vitest';
import i18n from '../i18n';
import helpDE from '../i18n/locales/de/help.json';
import helpEN from '../i18n/locales/en/help.json';

describe('i18n Configuration', () => {
  it('should be configured with German as default language', () => {
    expect(i18n.language).toBe('de');
  });

  it('should load common translations', () => {
    const appName = i18n.t('common:appName');
    expect(appName).toBe('OpenFarmPlanner');
  });

  it('should load navigation translations', () => {
    const plantingPlans = i18n.t('navigation:plantingPlans');
    expect(plantingPlans).toBe('Anbaupläne');

    const locations = i18n.t('navigation:locations');
    expect(locations).toBe('Standorte');

    expect(i18n.t('navigation:cropLibrary')).toBe('Öffentliche Kulturbibliothek');
    expect(i18n.t('navigation:cultureActions.library')).toBe('Aus Bibliothek importieren');
  });

  it('should load page-specific translations', () => {
    const locationsTitle = i18n.t('locations:title');
    expect(locationsTitle).toBe('Standorte');
    
    const culturesTitle = i18n.t('cultures:title');
    expect(culturesTitle).toBe('Kulturen');

    expect(i18n.t('cultures:library.dialogTitle')).toBe('Aus Kulturbibliothek importieren');
    expect(i18n.t('cultures:library.page.title')).toBe('Öffentliche Kulturbibliothek');
  });

  it('keeps English library naming distinct for navigation and import flows', () => {
    const t = i18n.getFixedT('en');

    expect(t('navigation:cropLibrary')).toBe('Public crop library');
    expect(t('navigation:cultureActions.library')).toBe('Import from library');
    expect(t('cultures:library.dialogTitle')).toBe('Import from crop library');
    expect(t('cultures:library.page.title')).toBe('Public crop library');
  });

  it('should support interpolation', () => {
    const harvestWindow = i18n.t('cultures:fields.harvestWindowValue', { first: 60, last: 90 });
    expect(harvestWindow).toBe('60–90 Tage nach der Aussaat');
  });

  it('should handle nested keys', () => {
    const addAction = i18n.t('common:actions.add');
    expect(addAction).toBe('Hinzufügen');
    
    const deleteAction = i18n.t('common:actions.delete');
    expect(deleteAction).toBe('Löschen');
  });

  it('should have all required namespaces', () => {
    const namespaces = ['common', 'navigation', 'home', 'locations', 'cultures', 'plantingPlans', 'fields', 'beds', 'hierarchy'];
    
    namespaces.forEach(ns => {
      expect(i18n.hasResourceBundle('de', ns)).toBe(true);
    });
  });

  it('uses compact page help introductions instead of "what do I see here" sections', () => {
    const helpResources = [helpDE, helpEN];
    const deprecatedTitles = new Set(['Was sehe ich hier?', 'What do I see here?']);

    helpResources.forEach((helpResource) => {
      Object.values(helpResource.pages).forEach((page) => {
        expect(page.intro).toEqual(expect.any(String));
        expect(page.intro.trim().length).toBeGreaterThan(0);
        expect(page.intro).not.toContain('•');

        page.sections?.forEach((section) => {
          expect(deprecatedTitles.has(section.title)).toBe(false);
          expect(section.points.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
