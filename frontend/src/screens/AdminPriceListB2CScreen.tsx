import { createAdminPriceListScreen } from './AdminPriceListBase';
import { SafeAreaView } from 'react-native-safe-area-context';

const AdminPriceListB2CScreen = createAdminPriceListScreen({
  priceKey: 'price',
  navTitle: 'Lista precio cliente (B2C)',
  headerTitle: 'Controla el precio público (B2C)',
  helper:
    'Estos valores se muestran en la tienda para clientes finales. Recuerda usar números enteros en pesos.',
  jumpLabel: 'Ver lista B2B',
  jumpRoute: 'AdminPriceListB2B',
  emptyLabel: 'Aún no hay productos registrados.',
  emptyWithSearchLabel: 'No encontramos coincidencias para tu búsqueda.',
  currentPriceLabel: 'Precio cliente',
});

export default AdminPriceListB2CScreen;
