import { useEffect, useState } from 'react';

import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from 'react-hook-form';

import { Switch } from '@mui/material';
import { DataGrid, GridColDef, GridRowParams } from '@mui/x-data-grid';

import api from '../../Services/api';
import Input from '../../Components/TextField';
import ButtonForm from '../../Components/ButtonForm';
import SearchComponent from '../../Components/SearchComponent';
import useMainLayoutContext from '../../Hooks/useMainLayoutContext';
import OrderItensDataGrid from '../../Components/OrderItemsDataGrid';
import {
  GridContainer,
  PageContainer,
  PageTitle,
} from '../../Components/StyleComponents';
import { AxiosError, isAxiosError } from 'axios';
import { ApiError } from '../../Types/common';

interface OrdemItemProps {
  id?: number;
  order_item_order: number;
  product_id: number;
  quantity: number;
  price: number;
  observation: string;
  description: string;
  item_total_value: number;
}

export interface OrderProps {
  id?: number;
  order_id?: number;
  client_id: number;
  client_name: string;
  delivery_date: string;
  observation: string;
  paid: boolean;
  delivery: boolean;
  total_value: number;
  itens: Array<OrdemItemProps>;
}

const formDefault = {
  order_id: 0,
  client_id: 0,
  client_name: '',
  delivery_date: new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  observation: '',
  paid: false,
  delivery: false,
  itens: [],
  total_value: 0,
};

export default function Orders() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [dataGridRows, setDataGridRows] = useState<OrderProps[]>([]);
  const [isLoadingButton, setIsLoadingButton] = useState(false);
  const [shouldDeleteItem, setShouldDeleteItem] = useState(false);
  const [paidFilter, setPaidFilter] = useState(true);
  const [dateFilterStart, setDateFilterStart] = useState(
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [dateFilterEnd, setDateFilterEnd] = useState(
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const {
    showToastMessage,
    setDialogInfo,
    setDialogHandleButtonAction,
    setShowDialog,
    handleFormError,
  } = useMainLayoutContext();

  const form = useForm<OrderProps>({ defaultValues: formDefault });
  const { control, getValues, setValue, reset, handleSubmit, formState } = form;
  const fieldArray = useFieldArray({ control: form.control, name: 'itens' });

  const dataGridColumns: GridColDef<(typeof dataGridRows)[number]>[] = [
    { field: 'id', headerName: 'Id', width: 10 },
    { field: 'order_id', headerName: 'Número', width: 80 },
    { field: 'client_name', headerName: 'Cliente', width: 300 },
    {
      field: 'delivery_date_formatted',
      headerName: 'Entrega',
      width: 110,
    },
  ];

  // API Communication
  async function loadOrders(orderId?: number) {
    try {
      setIsLoading(true);

      if (isEditable) setIsEditable(false);

      const { data } = await api.get(
        `Pedido/?startingDate=${dateFilterStart}&endingDate=${dateFilterEnd}&paid=${!paidFilter}`
      );

      const rows = data.map((item: OrderProps, index: number) => ({
        id: index + 1,
        order_id: item.order_id,
        client_id: item.client_id,
        client_name: item.client_id + ' - ' + item.client_name,
        delivery_date: new Date(item.delivery_date).toISOString().split('T')[0],
        delivery_date_formatted: new Date(
          item.delivery_date
        ).toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        observation: item.observation,
        paid: item.paid,
        total_value: item.total_value,
        delivery: item.delivery,
      }));

      setDataGridRows(rows);

      let orderGridIndex = rows.findIndex(
        (item: OrderProps) => item.order_id === orderId
      );

      if (orderGridIndex === -1) orderGridIndex = 0;

      reset({ ...rows[orderGridIndex] });
    } catch (error) {
      showToastMessage('Erro: ' + error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegisterOrder() {
    try {
      setIsLoadingButton(true);

      const formData = { ...getValues() };

      if (isNewRecord) delete formData.order_id;

      formData.client_id = parseInt(
        formData.client_name.substring(0, formData.client_name.indexOf('-')),
        10
      );

      if (formData.itens.length === 0)
        throw new Error('É obrigatório informar itens.');

      formData.itens = getValues('itens')
        .filter((item) => item.product_id !== 0)
        .map((item, index) => ({
          product_id: item.product_id,
          order_item_order: index + 1,
          quantity: Number(item.quantity.toString().replace(',', '.')),
          price: item.price,
          observation: item.observation,
          description: item.description,
          item_total_value: item.item_total_value,
        }));

      const formatedDate = getValues('delivery_date').replace(
        /(\d{2})\/(\d{2})\/(\d{4})/,
        '$3/$2/$1'
      );

      formData.delivery_date = formatedDate;

      const { data, status } = await api.post('Pedido', formData);

      if (status === 201 || status === 200) {
        loadOrders(data.id);
        setIsNewRecord(false);
        setIsEditable(false);
        showToastMessage(
          `Cadastro ${status === 201 ? 'realizado' : 'alterado'} com sucesso.`
        );
      }
    } catch (error) {
      showToastMessage('Erro: ' + error);
    } finally {
      setIsLoadingButton(false);
    }
  }

  async function handleDeleteOrder() {
    try {
      setIsLoadingButton(true);

      const orderId = getValues('order_id');

      const { status } = await api.delete(`Pedido/${orderId}`);

      if (status === 204) {
        const selectedItemIndex = dataGridRows.findIndex(
          (item) => item.id === orderId
        );

        const updatedList = dataGridRows.filter(
          (item) => item.order_id !== orderId
        );

        setDataGridRows(updatedList);

        reset(updatedList[selectedItemIndex - 1] || formDefault);

        showToastMessage('Exclusão realizada com sucesso.');
      }

      setShouldDeleteItem(false);
    } catch (error) {
      if (isAxiosError<ApiError>(error)) {
        const axiosError: AxiosError<ApiError> = error;

        const errorMessage = axiosError.response?.data?.error;

        showToastMessage('Erro: ' + errorMessage);
      } else {
        showToastMessage('Erro: ' + String(error));
      }
    } finally {
      setIsLoadingButton(false);
      setShowDialog(false);
    }
  }

  async function handleEditOrder() {
    const id = getValues('order_id');

    try {
      setIsLoadingButton(true);
      setValue('itens', []);

      const { data } = await api.get(`Pedido/${id}`);

      const itens = data.itens;

      for (let i = 0; i < itens.length; i++) {
        fieldArray.append(itens[i]);
      }

      setIsEditable(true);
    } catch (error) {
      showToastMessage('Erro: ' + error);
    } finally {
      setIsLoadingButton(false);
    }
  }

  // Form handling
  function handleAskDeleteOrder() {
    setDialogInfo({
      dialogTitle: 'Cadastro de Pedidos',
      dialogText: 'Excluir esse pedido?',
      dialogButtonText: 'Excluir',
    });

    setDialogHandleButtonAction(() => handleDeleteOrder);
    setShowDialog(true);
  }

  function handleAddOrder() {
    reset(formDefault);

    setIsNewRecord(true);
    setIsEditable(true);
  }

  function handleCancelEdit() {
    if (isNewRecord) {
      reset({
        ...dataGridRows[0],
      });
    } else {
      const selectedItemIndex = dataGridRows.findIndex(
        (item) => item.order_id === getValues('order_id')
      );

      reset({
        ...dataGridRows[selectedItemIndex],
      });
    }

    setIsEditable(false);
    setIsNewRecord(false);
  }

  function handleRowClick(params: GridRowParams) {
    const selectedItem = dataGridRows.find((item) => item.id === params.row.id);

    reset({ ...selectedItem });
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormProvider {...form}>
      <PageTitle>Pedidos</PageTitle>
      <PageContainer>
        <div
          style={{
            display: 'flex',
            width: '100%',
            borderBottom: '1px solid white',
            marginBottom: '20px',
          }}
        >
          <Input
            id="filter_date_start"
            label="Entrega de"
            width={140}
            type={'date'}
            value={dateFilterStart}
            setValue={(value) => setDateFilterStart(value as string)}
          />
          <Input
            id="filter_date_end"
            label="Entrega até"
            width={140}
            type={'date'}
            value={dateFilterEnd}
            setValue={(value) => setDateFilterEnd(value as string)}
          />
          <div
            style={{
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Switch
              checked={paidFilter}
              onChange={(_, checked) => setPaidFilter(checked)}
            />
            <h5 style={{ color: 'var(--font)' }}>Apenas pendentes</h5>
          </div>

          <div style={{ height: '30', marginLeft: '15px' }}>
            <ButtonForm
              title="Consultar"
              handleFunction={loadOrders}
              width={100}
            />
          </div>
        </div>
      </PageContainer>

      <PageContainer>
        <Controller
          name="order_id"
          control={control}
          render={({ field: { value, onChange } }) => (
            <Input
              id="order_id"
              label="Número"
              width={100}
              value={value}
              setValue={onChange}
              disabled
            />
          )}
        />

        <Controller
          name="client_name"
          control={control}
          rules={{ required: 'O cliente é obrigatório.' }}
          render={({ field: { value, onChange } }) => (
            <SearchComponent
              id="client_name"
              label="Cliente"
              type="client"
              width={500}
              disabled={!isEditable}
              value={value}
              setValue={onChange}
            />
          )}
        />

        <Controller
          name="delivery_date"
          control={control}
          render={({ field: { value, onChange } }) => (
            <Input
              id="delivery_date"
              label="Data de Entrega"
              width={150}
              type={'date'}
              value={value}
              setValue={onChange}
              disabled={!isEditable}
            />
          )}
        />

        <Controller
          name="delivery"
          control={control}
          render={({ field: { value, onChange } }) => (
            <div
              style={{
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Switch
                checked={value}
                onClick={onChange}
                disabled={!isEditable}
              />
              <h5 style={{ color: 'var(--font)' }}>Entregar</h5>
            </div>
          )}
        />
      </PageContainer>

      <PageContainer>
        <Controller
          name="observation"
          control={control}
          render={({ field: { value, onChange } }) => (
            <Input
              id="observation"
              label="Observação"
              width={615}
              value={value}
              setValue={onChange}
              disabled={!isEditable}
            />
          )}
        />

        <Controller
          name="total_value"
          control={control}
          render={({ field: { value, onChange } }) => (
            <Input
              id="total_value"
              label="Valor Total"
              width={150}
              value={value}
              setValue={onChange}
              disabled
            />
          )}
        />

        <Controller
          name="paid"
          control={control}
          render={({ field: { value, onChange } }) => (
            <div
              style={{
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Switch
                checked={value}
                onClick={onChange}
                disabled={!isEditable}
              />
              <h5 style={{ color: 'var(--font)' }}>Pedido Pago</h5>
            </div>
          )}
        />
      </PageContainer>

      {isEditable ? (
        <PageContainer>
          <ButtonForm
            title="Gravar"
            handleFunction={handleSubmit(handleRegisterOrder, () =>
              handleFormError(formState)
            )}
            loading={isLoadingButton}
          />

          <ButtonForm title="Cancelar" handleFunction={handleCancelEdit} />
        </PageContainer>
      ) : (
        <PageContainer>
          <ButtonForm title="Incluir" handleFunction={handleAddOrder} />

          <ButtonForm
            title="Alterar"
            handleFunction={async () => await handleEditOrder()}
          />

          <ButtonForm
            title="Excluir"
            handleFunction={handleAskDeleteOrder}
            loading={isLoadingButton && shouldDeleteItem}
          />
        </PageContainer>
      )}

      <GridContainer>
        {isEditable ? (
          <OrderItensDataGrid />
        ) : (
          <DataGrid
            rows={dataGridRows}
            columns={dataGridColumns}
            loading={isLoading}
            initialState={{
              pagination: {
                paginationModel: {
                  pageSize: 5,
                },
              },
            }}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            sx={{
              '& .MuiDataGrid-columnHeaders': {
                color: 'black',
                fontSize: '16px',
                fontWeight: 'bold',
              },
              '& .MuiDataGrid-cell': {
                color: 'var(--font)',
              },
              '& .MuiTablePagination-toolbar': {
                color: 'var(--font)',
              },
            }}
          />
        )}
      </GridContainer>
    </FormProvider>
  );
}
