import { createAdminPriceListScreen } from './AdminPriceListBase';

const AdminPriceListB2BScreen = createAdminPriceListScreen({
  priceKey: 'b2bPrice',
  navTitle: 'Lista de precios negocios (B2B)',
  headerTitle: 'Ajusta precios para negocios (B2B)',
  helper:
    'Define aquí los precios mayoristas para clientes de tipo Negocio. Usa valores enteros en pesos.',
  jumpLabel: 'Ver lista B2C',
  jumpRoute: 'AdminPriceListB2C',
  emptyLabel: 'Todavía no hay productos en la lista.',
  emptyWithSearchLabel: 'No hay coincidencias para tu búsqueda.',
  currentPriceLabel: 'Precio negocio',
  referenceLabel: 'Precio cliente',
});

export default AdminPriceListB2BScreen;
