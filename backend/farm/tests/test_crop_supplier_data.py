from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from farm.models import Crop, CropSupplierData, Project, ProjectMembership, Supplier


User = get_user_model()


class CropSupplierDataApiTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='supplierdata', email='supplierdata@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Supplier Data Project', slug='supplier-data-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)

        self.supplier = Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        self.crop = Crop.objects.create(name='Karotte', variety='Nantaise', project=self.project)

    def test_create_supplier_data_record(self):
        payload = {
            'crop': self.crop.id,
            'supplier_id': self.supplier.id,
            'supplier_product_name': 'Nantaise fein',
            'supplier_product_url': 'https://reinsaat.example/karotte',
            'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
        }

        response = self.client.post('/openfarmplanner/api/crop-supplier-data/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CropSupplierData.objects.count(), 1)
        row = CropSupplierData.objects.get()
        self.assertEqual(row.crop_id, self.crop.id)
        self.assertEqual(row.supplier_id, self.supplier.id)

    def test_crop_detail_includes_supplier_data(self):
        CropSupplierData.objects.create(
            crop=self.crop,
            project=self.project,
            supplier=self.supplier,
            supplier_name='Reinsaat',
            supplier_product_name='Nantaise fein',
            packaging_sizes=[{'size_value': 5, 'size_unit': 'g'}, {'size_value': 25, 'size_unit': 'g'}],
        )

        response = self.client.get(f'/openfarmplanner/api/crops/{self.crop.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('supplier_data', response.data)
        self.assertEqual(len(response.data['supplier_data']), 1)
        self.assertEqual(response.data['supplier_data'][0]['supplier_product_name'], 'Nantaise fein')
        self.assertEqual(
            response.data['supplier_data'][0]['packaging_sizes'],
            [{'size_value': 5, 'size_unit': 'g'}, {'size_value': 25, 'size_unit': 'g'}],
        )

    def test_supplier_tkg_input_is_rejected(self):
        payload = {
            'crop': self.crop.id,
            'supplier_id': self.supplier.id,
            'supplier_product_name': 'Nantaise fein',
            'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
            'thousand_kernel_weight_g': 3.9,
        }

        response = self.client.post('/openfarmplanner/api/crop-supplier-data/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('thousand_kernel_weight_g', response.data)
