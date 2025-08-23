import React from 'react';
import { View, Text, TextInput, Button, Switch } from 'react-native';
import { useForm } from 'react-hook-form';
import { createAddress } from '../lib/api.addresses';

type Form = {
  label: string; recipient: string; phone: string; line1: string;
  line2?: string; isDefault?: boolean;
};

export default function AddressFormScreen({ navigation }: any) {
  const { register, setValue, handleSubmit, watch } = useForm<Form>({ defaultValues: { isDefault: true } });

  React.useEffect(() => {
    register('label'); register('recipient'); register('phone'); register('line1'); register('line2'); register('isDefault');
  }, [register]);

  const onSubmit = async (data: Form) => {
    await createAddress(data);
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text>Etiqueta</Text>
      <TextInput style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }} onChangeText={(t)=>setValue('label',t)} placeholder="Casa / Hotel / Trabajo" />

      <Text>Destinatario</Text>
      <TextInput style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }} onChangeText={(t)=>setValue('recipient',t)} placeholder="A nombre de" />

      <Text>Teléfono</Text>
      <TextInput keyboardType="phone-pad" style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }} onChangeText={(t)=>setValue('phone',t)} placeholder="310..." />

      <Text>Dirección</Text>
      <TextInput style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }} onChangeText={(t)=>setValue('line1',t)} placeholder="Cra/Cll # No" />
      <TextInput style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10 }} onChangeText={(t)=>setValue('line2',t)} placeholder="Apto/Habitación (opcional)" />

      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginVertical:8 }}>
        <Switch value={!!watch('isDefault')} onValueChange={(v)=>setValue('isDefault', v)} />
        <Text>Predeterminada</Text>
      </View>

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} />
    </View>
  );
}
