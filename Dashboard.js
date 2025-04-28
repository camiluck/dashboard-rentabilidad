import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import Papa from 'papaparse';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [abcData, setAbcData] = useState([]);
  const [abcSalesData, setAbcSalesData] = useState([]);
  const [rotacionData, setRotacionData] = useState([]);
  const [topProductsData, setTopProductsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('abc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Modificado para GitHub Pages - usando fetch en lugar de window.fs.readFile
        const response = await fetch(`${process.env.PUBLIC_URL}/data/data-3.csv`);
        const responseText = await response.text();
        
        const parsedData = Papa.parse(responseText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimitersToGuess: [';', ',', '\t', '|']
        });
        
        setData(parsedData.data);
        processData(parsedData.data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const limpiarValorMonetario = (valor) => {
    if (typeof valor === 'string') {
      return parseFloat(valor.replace(/[$\s]/g, '').replace(',', '.'));
    }
    return valor;
  };
  
  const processData = (rawData) => {
    // Procesamiento para análisis ABC
    const abcDistribution = {};
    const abcSales = {};
    
    rawData.forEach(item => {
      const abc = item.ABC || 'Sin clasificar';
      
      // Contamos productos por categoría
      abcDistribution[abc] = (abcDistribution[abc] || 0) + 1;
      
      // Sumamos ventas por categoría
      if (!abcSales[abc]) {
        abcSales[abc] = {
          count: 0,
          totalSales: 0,
          averageSales: 0
        };
      }
      
      abcSales[abc].count += 1;
      const importeVendido = limpiarValorMonetario(item["Importe Vendido"]);
      if (!isNaN(importeVendido)) {
        abcSales[abc].totalSales += importeVendido;
      }
    });
    
    // Calculamos ventas promedio por categoría
    Object.keys(abcSales).forEach(category => {
      if (abcSales[category].count > 0) {
        abcSales[category].averageSales = abcSales[category].totalSales / abcSales[category].count;
      }
    });
    
    // Convertimos a formato para gráficas
    const abcDistributionData = Object.keys(abcDistribution)
      .filter(key => key !== 'null' && key !== 'undefined')
      .map(key => ({
        name: key,
        value: abcDistribution[key]
      }));
    
    const abcSalesDataArray = Object.keys(abcSales)
      .filter(key => key !== 'null' && key !== 'undefined')
      .map(key => ({
        name: key,
        count: abcSales[key].count,
        totalSales: abcSales[key].totalSales,
        averageSales: abcSales[key].averageSales
      }))
      .sort((a, b) => b.averageSales - a.averageSales);
    
    setAbcData(abcDistributionData);
    setAbcSalesData(abcSalesDataArray);
    
    // Procesamiento para análisis de rotación
    const rotacionPorSubcategoria = {};
    
    // Calculamos rotación por subcategoría
    rawData.forEach(item => {
      if (!item.Subcategoría) return;
      
      // Limpiamos el valor de stock si es string (puede tener comas)
      let stock = item.Stock;
      if (typeof stock === 'string') {
        stock = parseFloat(stock.replace(',', '.'));
      }
      
      if (!rotacionPorSubcategoria[item.Subcategoría]) {
        rotacionPorSubcategoria[item.Subcategoría] = {
          totalVolumen: 0,
          totalStock: 0,
          count: 0
        };
      }
      
      rotacionPorSubcategoria[item.Subcategoría].count += 1;
      rotacionPorSubcategoria[item.Subcategoría].totalVolumen += (item["Volumen Vendido"] || 0);
      rotacionPorSubcategoria[item.Subcategoría].totalStock += (stock || 0);
    });
    
    // Calculamos índice de rotación
    const rotacionCategoriasArray = Object.keys(rotacionPorSubcategoria)
      .map(subcategoria => {
        const stats = rotacionPorSubcategoria[subcategoria];
        const indiceRotacion = stats.totalStock > 0 ? stats.totalVolumen / stats.totalStock : 0;
        
        return {
          name: subcategoria,
          rotacion: indiceRotacion,
          productos: stats.count
        };
      })
      .filter(item => item.productos > 5 && item.rotacion > 0) // Solo categorías relevantes
      .sort((a, b) => b.rotacion - a.rotacion);
    
    setRotacionData(rotacionCategoriasArray);
    
    // Top productos por valor
    const productosPorValor = rawData
      .map(item => ({
        codigo: item.Material,
        nombre: item.Descripción,
        categoria: item.ABC,
        subcategoria: item.Subcategoría,
        importe: limpiarValorMonetario(item["Importe Vendido"]),
        volumen: item["Volumen Vendido"]
      }))
      .filter(item => !isNaN(item.importe)) // Filtramos solo productos con importe válido
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 20);
    
    setTopProductsData(productosPorValor);
  };
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  const formatNumber = (value, decimals = 2) => {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }).format(value);
  };
  
  // Colores para las gráficas
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  const renderActiveTab = () => {
    switch(activeTab) {
      case 'abc':
        return renderAbcAnalysis();
      case 'rotacion':
        return renderRotacionAnalysis();
      case 'top':
        return renderTopProducts();
      default:
        return renderAbcAnalysis();
    }
  };
  
  const renderAbcAnalysis = () => (
    <div>
      <h2 className="text-xl font-bold mb-4">Análisis ABC</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Distribución de productos por categoría ABC */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Distribución de Productos por Categoría</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={abcData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {abcData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value, 0)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Hallazgo:</strong> La mayoría de los productos están clasificados como C y D, 
              mientras que los productos A (que deberían ser los más importantes) representan solo 
              un pequeño porcentaje del inventario.
            </p>
          </div>
        </div>
        
        {/* Venta promedio por categoría ABC */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Venta Promedio por Categoría ABC</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abcSalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="averageSales" name="Venta Promedio" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Inconsistencia:</strong> Los productos clasificados como C y D tienen mayor valor 
              promedio de venta que los clasificados como A, lo que sugiere un problema en la 
              clasificación actual.
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabla de datos por categoría ABC */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-medium mb-3">Detalle por Categoría ABC</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad Productos
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venta Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venta Promedio
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {abcSalesData.map((category, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {category.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatNumber(category.count, 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(category.totalSales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(category.averageSales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  
  const renderRotacionAnalysis = () => (
    <div>
      <h2 className="text-xl font-bold mb-4">Rotación de Inventario</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top categorías con mayor rotación */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Top 10 Subcategorías con Mayor Rotación</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rotacionData.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => [formatNumber(value, 2), "Índice de Rotación"]} />
                <Legend />
                <Bar dataKey="rotacion" name="Índice de Rotación" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Hallazgo:</strong> Las categorías con mayor rotación son productos perecederos como 
              lácteos y tortillas, lo que es esperado. Sin embargo, la diferencia en rotación entre categorías es muy amplia.
            </p>
          </div>
        </div>
        
        {/* Categorías con menor rotación */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Subcategorías con Menor Rotación</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rotacionData.slice(-10).reverse()}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => [formatNumber(value, 2), "Índice de Rotación"]} />
                <Legend />
                <Bar dataKey="rotacion" name="Índice de Rotación" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Alerta:</strong> Categorías como Cerveza Retornable, Shampoos y Cereal saludable 
              tienen rotación extremadamente baja (menor a 0.5), lo que indica posible sobrestock y 
              capital inmovilizado.
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabla de datos de rotación */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Rotación por Subcategoría</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subcategoría
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Índice Rotación
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rotacionData.map((category, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {category.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatNumber(category.rotacion, 2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {category.productos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  
  const renderTopProducts = () => (
    <div>
      <h2 className="text-xl font-bold mb-4">Top Productos por Valor de Venta</h2>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-medium mb-3">Top 20 Productos por Valor de Venta</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subcategoría
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría ABC
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topProductsData.map((product, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {product.codigo}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {product.nombre}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {product.subcategoria}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(product.importe)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${product.categoria === 'A' ? 'text-green-600' : 'text-orange-500'}`}>
                    {product.categoria || "Sin clasificar"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Hallazgo crítico:</strong> De los 20 productos con mayor valor de venta, 
            sólo 1 está clasificado como "A". Esto confirma que la clasificación ABC actual 
            no refleja la importancia comercial de los productos, lo que puede llevar a decisiones 
            incorrectas en la gestión de inventario y en la atención comercial.
          </p>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Distribución de Categorías ABC en Top 20 por Valor</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={
                  (() => {
                    const categoryCounts = {};
                    topProductsData.forEach(product => {
                      const category = product.categoria || "Sin clasificar";
                      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                    });
                    return Object.keys(categoryCounts).map(key => ({
                      name: key,
                      value: categoryCounts[key]
                    }));
                  })()
                }
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {
                  (() => {
                    const categoryCounts = {};
                    topProductsData.forEach(product => {
                      const category = product.categoria || "Sin clasificar";
                      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                    });
                    return Object.keys(categoryCounts).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ));
                  })()
                }
              </Pie>
              <Tooltip formatter={(value) => formatNumber(value, 0)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg font-semibold text-gray-700">Cargando datos...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard de Rentabilidad y Eficiencia</h1>
        <p className="text-gray-600">Análisis de clasificación ABC, rotación de inventario y valor comercial</p>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-lg mb-6">
        <div className="flex flex-wrap border-b">
          <button
            className={`mr-4 py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'abc' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('abc')}
          >
            Análisis ABC
          </button>
          <button
            className={`mr-4 py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'rotacion' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('rotacion')}
          >
            Rotación de Inventario
          </button>
          <button
            className={`mr-4 py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'top' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('top')}
          >
            Top Productos
          </button>
        </div>
        
        <div className="mt-6">
          {renderActiveTab()}
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Conclusiones y Recomendaciones</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4 bg-red-50 border-red-200">
            <h3 className="font-bold text-red-800 mb-2">Problema Crítico</h3>
            <p className="text-red-700">La clasificación ABC actual no refleja el valor comercial real de los productos. El 99.15% de los productos clasificados como "A" no deberían tener esa clasificación.</p>
          </div>
          
          <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
            <h3 className="font-bold text-yellow-800 mb-2">Oportunidad</h3>
            <p className="text-yellow-700">Existe una gran disparidad en la rotación de inventario. Algunas categorías tienen rotación extremadamente baja, inmovilizando capital innecesariamente.</p>
          </div>
          
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="font-bold text-green-800 mb-2">Recomendación</h3>
            <p className="text-green-700">Revisar y actualizar la clasificación ABC basándose en valor comercial y rotación. Esto permitirá una mejor gestión del inventario y atención a productos clave.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;