import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('../api/httpClient', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import api, {
  bedAPI,
  cropAPI,
  fieldAPI,
  locationAPI,
  plantingPlanAPI,
  supplierAPI,
  seedDemandAPI,
  fetchAllPaginated,
} from '../api/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follows every backend pagination link', async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: '/planting-plans/?page=2',
          previous: null,
          results: [{ id: 1 }, { id: 2 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: '/planting-plans/',
          results: [{ id: 3 }],
        },
      });

    await expect(fetchAllPaginated<{ id: number }>('/planting-plans/')).resolves.toEqual({
      count: 3,
      next: null,
      previous: null,
      results: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    expect(getMock).toHaveBeenNthCalledWith(1, '/planting-plans/?page_size=1000');
    expect(getMock).toHaveBeenNthCalledWith(2, '/planting-plans/?page=2');
  });

  it('strips the host from an absolute pagination `next` URL so requests stay same-origin', async () => {
    // DRF builds `next` as an absolute URL using the backend's own host (e.g. when the
    // dev proxy rewrites the request Host header). Following it verbatim would bypass
    // the frontend's proxy and drop same-origin cookies, so only the query string may be reused.
    getMock
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: 'http://127.0.0.1:8000/api/planting-plans/?page=2&page_size=1000',
          previous: null,
          results: [{ id: 1 }, { id: 2 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: '/planting-plans/',
          results: [{ id: 3 }],
        },
      });

    await expect(fetchAllPaginated<{ id: number }>('/planting-plans/')).resolves.toEqual({
      count: 3,
      next: null,
      previous: null,
      results: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    expect(getMock).toHaveBeenNthCalledWith(1, '/planting-plans/?page_size=1000');
    expect(getMock).toHaveBeenNthCalledWith(2, '/planting-plans/?page=2&page_size=1000');
  });

  it('calls all crop endpoints with expected URLs and payloads', () => {
    const cropData = { name: 'Karotte' };
    const importPreviewData = [{ name: 'Tomate' }];
    const importApplyData = { items: importPreviewData, confirm_updates: true };

    cropAPI.list();
    cropAPI.get(7);
    cropAPI.create(cropData as never);
    cropAPI.update(7, cropData as never);
    cropAPI.delete(7);
    cropAPI.importPreview(importPreviewData);
    cropAPI.importApply(importApplyData);

    expect(getMock).toHaveBeenCalledWith('/crops/');
    expect(getMock).toHaveBeenCalledWith('/crops/7/');
    expect(postMock).toHaveBeenCalledWith('/crops/', cropData);
    expect(putMock).toHaveBeenCalledWith('/crops/7/', cropData);
    expect(deleteMock).toHaveBeenCalledWith('/crops/7/');
    expect(postMock).toHaveBeenCalledWith('/crops/import/preview/', importPreviewData);
    expect(postMock).toHaveBeenCalledWith('/crops/import/apply/', importApplyData);
  });

  it('calls supplier endpoints and handles optional query params', () => {
    const supplierData = { id: 1, name: 'Biohof' };

    supplierAPI.list();
    supplierAPI.list('bio');
    supplierAPI.get(1);
    supplierAPI.create('Neuer Lieferant');
    supplierAPI.update(1, supplierData as never);
    supplierAPI.delete(1);

    expect(getMock).toHaveBeenCalledWith('/suppliers/', { params: {} });
    expect(getMock).toHaveBeenCalledWith('/suppliers/', { params: { q: 'bio' } });
    expect(getMock).toHaveBeenCalledWith('/suppliers/1/');
    expect(postMock).toHaveBeenCalledWith('/suppliers/', {
      name: 'Neuer Lieferant',
      homepage_url: undefined,
      allowed_domains: [],
    });
    expect(putMock).toHaveBeenCalledWith('/suppliers/1/', supplierData);
    expect(deleteMock).toHaveBeenCalledWith('/suppliers/1/');
  });

  it('calls bed endpoints', () => {
    const bedData = { name: 'Beet A' };

    bedAPI.list();
    bedAPI.get(3);
    bedAPI.create(bedData as never);
    bedAPI.update(3, bedData as never);
    bedAPI.delete(3);

    expect(getMock).toHaveBeenCalledWith('/beds/');
    expect(getMock).toHaveBeenCalledWith('/beds/3/');
    expect(postMock).toHaveBeenCalledWith('/beds/', bedData);
    expect(putMock).toHaveBeenCalledWith('/beds/3/', bedData);
    expect(deleteMock).toHaveBeenCalledWith('/beds/3/');
  });

  it('calls planting plan endpoints', () => {
    const planData = { name: 'Frühjahr' };

    plantingPlanAPI.list();
    plantingPlanAPI.get(4);
    plantingPlanAPI.create(planData as never);
    plantingPlanAPI.update(4, planData as never);
    plantingPlanAPI.delete(4);
    plantingPlanAPI.remainingArea({
      bed_id: 3,
      start_date: '2024-03-01',
      end_date: '2024-04-01',
      exclude_plan_id: 4,
    });

    expect(getMock).toHaveBeenCalledWith('/planting-plans/');
    expect(getMock).toHaveBeenCalledWith('/planting-plans/4/');
    expect(postMock).toHaveBeenCalledWith('/planting-plans/', planData);
    expect(putMock).toHaveBeenCalledWith('/planting-plans/4/', planData);
    expect(deleteMock).toHaveBeenCalledWith('/planting-plans/4/');
    expect(getMock).toHaveBeenCalledWith('/planting-plans/remaining-area/', {
      params: {
        bed_id: 3,
        start_date: '2024-03-01',
        end_date: '2024-04-01',
        exclude_plan_id: 4,
      },
    });
  });

  it('calls field and location endpoints', () => {
    const fieldData = { name: 'Feld 1' };
    const locationData = { name: 'Nord' };

    fieldAPI.list();
    fieldAPI.get(5);
    fieldAPI.create(fieldData as never);
    fieldAPI.update(5, fieldData as never);
    fieldAPI.delete(5);

    locationAPI.list();
    locationAPI.get(9);
    locationAPI.create(locationData as never);
    locationAPI.update(9, locationData as never);
    locationAPI.delete(9);

    expect(getMock).toHaveBeenCalledWith('/fields/');
    expect(getMock).toHaveBeenCalledWith('/fields/5/');
    expect(postMock).toHaveBeenCalledWith('/fields/', fieldData);
    expect(putMock).toHaveBeenCalledWith('/fields/5/', fieldData);
    expect(deleteMock).toHaveBeenCalledWith('/fields/5/');

    expect(getMock).toHaveBeenCalledWith('/locations/');
    expect(getMock).toHaveBeenCalledWith('/locations/9/');
    expect(postMock).toHaveBeenCalledWith('/locations/', locationData);
    expect(putMock).toHaveBeenCalledWith('/locations/9/', locationData);
    expect(deleteMock).toHaveBeenCalledWith('/locations/9/');
  });


  it('calls seed demand endpoint', () => {
    seedDemandAPI.list();
    seedDemandAPI.list('3:11');
    seedDemandAPI.saveSupplierSelection(3, 11);
    seedDemandAPI.saveSupplierSelection(3, null);

    expect(getMock).toHaveBeenCalledWith('/seed-demand/', { params: {} });
    expect(getMock).toHaveBeenCalledWith('/seed-demand/', { params: { supplier_selection: '3:11' } });
    expect(postMock).toHaveBeenCalledWith('/seed-demand/', { crop_id: 3, supplier_id: 11 });
    expect(postMock).toHaveBeenCalledWith('/seed-demand/', { crop_id: 3, supplier_id: null });
  });

  it('exports grouped default API object', () => {
    expect(api.crops).toBe(cropAPI);
    expect(api.suppliers).toBe(supplierAPI);
    expect(api.beds).toBe(bedAPI);
    expect(api.plantingPlans).toBe(plantingPlanAPI);
    expect(api.fields).toBe(fieldAPI);
    expect(api.locations).toBe(locationAPI);
    expect(api.seedDemand).toBe(seedDemandAPI);
  });
});
