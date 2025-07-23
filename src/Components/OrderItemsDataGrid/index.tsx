import { useCallback, useEffect, useState } from 'react';

import { useFieldArray, useFormContext } from 'react-hook-form';

import { GridFooterContainer } from '@mui/x-data-grid';
import { DataGrid, GridColDef, GridEventListener } from '@mui/x-data-grid';
import { Button, MenuItem, Select, SelectChangeEvent } from '@mui/material';

import api from '../../Services/api';
import { OrderProps } from '../../Pages/Orders';
import useMainLayoutContext from '../../Hooks/useMainLayoutContext';

interface ItensProps {
  id: number;
  order_item_order: number;
  product_id: number;
  item_id?: number;
  description: string;
  quantity: number;
  price: number;
  observation: string;
  selectedItem?: number | '';
  item_total_value: number;
}

interface SelectItemProps {
  id?: number;
  product_id: number;
  description: string;
  price: number;
  quantity: number;
}

const ProductSelectCell = ({
  value,
  rowId,
  options,
  onChange,
}: {
  value: number | '';
  rowId: number | string;
  options: SelectItemProps[];
  onChange: (event: SelectChangeEvent<number>, rowIndex: number) => void;
}) => {
  return (
    <Select
      id={`select-${rowId}`}
      value={value}
      onChange={(event) => onChange(event, Number(rowId) - 1)}
      displayEmpty
      sx={{
        width: 300,
        left: -10,
        color: 'var(--font)',
        borderColor: 'var(--font)',
      }}
    >
      {options.map((item) => (
        <MenuItem key={item.product_id} value={item.product_id}>
          {item.description}
        </MenuItem>
      ))}
    </Select>
  );
};

export default function OrderItemsDataGrid() {
  const [itemRows, setItemsRows] = useState<ItensProps[]>([]);
  const [selectOptions, setSelectOptions] = useState<SelectItemProps[]>([]);

  const { showToastMessage } = useMainLayoutContext();

  const form = useFormContext<OrderProps>();
  const fieldArray = useFieldArray({ control: form.control, name: 'itens' });

  const itemDataGridColumns: GridColDef<ItensProps>[] = [
    { field: 'id', headerName: 'Id', width: 10 },
    { field: 'product_id', headerName: 'Código', width: 70 },
    {
      field: 'description',
      headerName: 'Produto',
      width: 300,
      renderCell: (params) => (
        <ProductSelectCell
          value={params.row.selectedItem ?? ''}
          rowId={params.id}
          options={selectOptions}
          onChange={handleChange}
        />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Qtde.',
      width: 80,
      editable: true,
    },
    {
      field: 'price',
      headerName: 'Preço',
      width: 70,
      editable: true,
    },
    {
      field: 'item_total_value',
      headerName: 'Valor',
      width: 90,
      editable: false,
    },
    {
      field: 'observation',
      headerName: 'Observação',
      width: 250,
      editable: true,
    },
    {
      field: 'delete',
      headerName: 'Excluir',
      width: 85,
      renderCell: (params) => (
        <Button
          onClick={() =>
            handleDeleteSingleItem(parseInt(String(params.id), 10))
          }
          sx={{
            backgroundColor: '#ffc6c6',
            color: 'red',
            fontWeight: 'bold',
          }}
        >
          x
        </Button>
      ),
    },
  ];

  // API Communication
  const loadItensSelect = useCallback(async () => {
    try {
      const { data } = await api.get('Produto');

      const obj = data.map((item: SelectItemProps, index: number) => ({
        id: index + 1,
        product_id: item.product_id,
        description: item.description,
        price: item.price,
        quantity: item.quantity,
      }));

      setSelectOptions(obj);
    } catch (error) {
      showToastMessage('Erro: ' + error);
    }
  }, [showToastMessage]);

  // Grid handling events
  const handleChange = useCallback(
    (event: SelectChangeEvent<number>, rowIndex: number) => {
      const selectedId = event.target.value as number;

      const existingIndex = itemRows.findIndex(
        (item) => item.product_id === selectedId
      );

      if (existingIndex !== -1) {
        const updatedRows = [...itemRows];

        updatedRows[existingIndex].quantity =
          Number(updatedRows[existingIndex].quantity) + 1;

        const total =
          updatedRows[existingIndex].quantity *
          updatedRows[existingIndex].price;

        updatedRows[existingIndex].item_total_value = parseFloat(
          total.toFixed(2)
        );

        setItemsRows(updatedRows);

        fieldArray.update(existingIndex, updatedRows[existingIndex]);
      } else {
        const selectedIngredient = selectOptions.find(
          (item) => item.product_id === selectedId
        );

        const updatedItem = {
          id: rowIndex + 1,
          selectedItem: selectedId,
          product_id: selectedIngredient?.product_id || 0,
          description: selectedIngredient?.description || '',
          price: selectedIngredient?.price || 0,
          quantity: 1,
          observation: '',
          order_item_order: rowIndex,
          item_total_value: selectedIngredient?.price || 0 * 1,
        };

        fieldArray.remove(rowIndex);
        fieldArray.insert(rowIndex, updatedItem);

        setItemsRows((prevRows) =>
          prevRows.map((row, index) => (index === rowIndex ? updatedItem : row))
        );
      }
    },
    [fieldArray, itemRows, selectOptions]
  );

  const handleProcessRowUpdate = useCallback(
    (newRow: ItensProps) => {
      fieldArray.update(newRow.id - 1, newRow);

      const newItens = form.getValues('itens').map((item, index) => ({
        ...item,
        item_total_value: Number((item.price * item.quantity).toFixed(2)),
        id: index + 1,
      }));

      setItemsRows(newItens);

      return newRow;
    },
    [fieldArray, form]
  );

  const addNewRow = useCallback(() => {
    setItemsRows((prevRows) => [
      ...prevRows,
      {
        id: prevRows.length + 1 || 0,
        product_id: 0,
        description: '',
        quantity: 0,
        selectedItem: '',
        order_item_order: 999,
        price: 0,
        observation: '',
        item_total_value: 0,
      },
    ]);
  }, []);

  const handleKeyDown: GridEventListener<'cellKeyDown'> = (params, event) => {
    if (event.key === 'ArrowDown') {
      const isLastRow = params.id === itemRows[itemRows.length - 1].id;

      if (isLastRow && itemRows[itemRows.length - 1].product_id) {
        addNewRow();
      }
    }
  };

  // Form handling events
  function loadDataGridItens() {
    const itens = form.getValues('itens') || [];

    const updatedItens = itens.map((item, index) => ({
      ...item,
      id: index + 1,
      selectedItem: item.product_id,
    }));

    setItemsRows(updatedItens);
  }

  const handleDeleteSingleItem = useCallback(
    (id: number) => {
      const indexToRemove = itemRows.findIndex((item) => item.id === id);

      if (indexToRemove === -1) return;

      fieldArray.remove(indexToRemove);

      setItemsRows((prevRows) =>
        prevRows.filter((_, index) => index !== indexToRemove)
      );
    },
    [fieldArray, itemRows]
  );

  useEffect(() => {
    loadItensSelect();
    loadDataGridItens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function AddItemButton() {
    return (
      <GridFooterContainer>
        <Button
          sx={{
            margin: '10px',
            backgroundColor: '#d7ffc6',
            color: 'green',
            fontSize: '15px',
            textTransform: 'none',
          }}
          onClick={() => addNewRow()}
        >
          Adicionar item
        </Button>
      </GridFooterContainer>
    );
  }

  return (
    <DataGrid
      rows={itemRows}
      columns={itemDataGridColumns}
      initialState={{
        pagination: {
          paginationModel: {
            pageSize: 30,
          },
        },
      }}
      pageSizeOptions={[30]}
      disableRowSelectionOnClick
      onCellKeyDown={handleKeyDown}
      slots={{
        footer: AddItemButton,
      }}
      processRowUpdate={handleProcessRowUpdate}
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
  );
}
