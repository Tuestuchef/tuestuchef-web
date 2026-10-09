# Guía: cargar el catálogo de Tuestuchef en producción

Basada en la lista de productos del 05/10/26. Sigue los pasos **en orden**: cada uno usa lo que creaste en el anterior. Marca cada casilla al terminarla.

Todo se hace con usuario **owner o admin**.

> **Regla de oro:** el SKU (código de inventario) de cada variante se arma **al crearla**, con los códigos de la categoría, del modelo, del cierre o corte, del color y de la talla. Si un código está mal, corrígelo **antes** de crear las variantes: cambiarlo después no actualiza los SKU que ya existen.

---

## Paso 0 · Antes de empezar

- [ ] La actualización con el **Código del modelo** está publicada en producción (código desplegado y `npm run db:push` hecho en producción). Sin ella, el campo **Código del modelo** no aparece y los SKU de modelos parecidos se repiten.
- [ ] Tienes a mano las **tallas de los pantalones** (lo único que falta en la lista; ver **Pendiente** al final).

---

## Paso 1 · Cuentas y métodos de pago

Los precios se cargan por método de pago, así que primero deben existir los métodos. Si ya los tienes, solo revisa que estén así.

**Configuración → Cuentas → Nuevo**

| Nombre (ejemplo)   | Tipo             | Moneda |
| ------------------ | ---------------- | ------ |
| Banco (pago móvil) | Banco            | VES    |
| Caja dólares       | Efectivo         | USD    |
| Zelle              | Zelle            | USD    |
| Binance            | Billetera cripto | USDT   |

- [ ] Las 4 cuentas existen (la moneda no se puede cambiar después).

**Configuración → Métodos de pago → Nuevo método**

| Nombre     | Cuenta donde cae el dinero | Tasa para cobrar en Bs | Orden |
| ---------- | -------------------------- | ---------------------- | ----- |
| Pago móvil | Banco (pago móvil)         | Tasa BCV dólar         | 1     |
| Efectivo   | Caja dólares               | —                      | 2     |
| Zelle      | Zelle                      | —                      | 3     |
| USDT       | Binance                    | —                      | 4     |

- [ ] Los 4 métodos existen y están activos.
- [ ] **Efectivo** va antes que **Zelle** en el orden: el mensaje de WhatsApp de la calculadora usa el primer método en dólares como "USD".

---

## Paso 2 · Categorías

**Configuración → Categorías de producto → Nuevo**

| Nombre     | Código | Orden |
| ---------- | ------ | ----- |
| Filipinas  | FIL    | 1     |
| Pantalones | PAN    | 2     |
| Estuches   | EST    | 3     |
| Delantales | DEL    | 4     |
| Gorros     | GOR    | 5     |

- [ ] Las 5 categorías existen.

> La bandana va en **Gorros**. Si prefieres que tenga su propia categoría, créala (ej.: Bandanas, `BAN`) y en el paso 6 no le pongas código de modelo.

---

## Paso 3 · Tallas

**Configuración → Tallas.** Ya vienen XS, S, M, L, XL y XXL.

- [ ] Edita **XXL**: Nombre `2XL`, Código `2XL` (así sale en la lista y en el SKU: `FIL-MC-C-BR-NEG-2XL`).
- [ ] Crea **3XL, 4XL, 5XL y 6XL** (Nuevo, con el mismo texto como código; Orden 7, 8, 9 y 10).
- [ ] Si los pantalones usan tallas que no están (XS, numéricas…), créalas aquí con su código antes del paso 6. Desactiva las que nadie use (p. ej. XS si no hay).

---

## Paso 4 · Colores

**Configuración → Colores → Nuevo**

| Nombre         | Código | Se usa en                                                                   |
| -------------- | ------ | --------------------------------------------------------------------------- |
| Negro          | NEG    | todo                                                                        |
| Blanco         | BLA    | filipinas, delantales, gorros                                               |
| Vinotinto      | VIN    | filipinas                                                                   |
| Verde militar  | VMI    | filipinas                                                                   |
| Azul marino    | AZM    | filipinas                                                                   |
| Gris plomo     | GPL    | filipinas, delantales, gorros                                               |
| Gris hércules  | GHE    | filipinas                                                                   |
| Kaki           | KAK    | filipinas, delantales, gorros                                               |
| Azul eléctrico | AZE    | estuches, delantales, gorros                                                |
| Gris           | GRI    | pantalones, estuches (bordes) · distinto del gris plomo y del gris hércules |
| Pata de gallo  | PDG    | pantalones                                                                  |
| Morado         | MOR    | estuches (bordes)                                                           |
| Naranja        | NAR    | estuches (bordes)                                                           |
| Verde neón     | VNE    | estuches (bordes)                                                           |
| Dorado         | DOR    | estuches (bordes)                                                           |
| Fucsia         | FUC    | estuches (bordes)                                                           |
| Rosa           | ROS    | estuches (bordes)                                                           |

- [ ] Los 17 colores existen.

> En los estuches el color es el del **borde** (el cuerpo siempre es negro): "Estuche Maxi con bordes morados" es la variante **Morado** del Estuche Maxi; "todo negro" es **Negro**.
> Usa siempre el mismo nombre para el mismo color: **Vinotinto** (no "vinotinta"), **Negro** (no "negra"), **Blanco** (no "blanca").

---

## Paso 5 · Cómo se crea cada producto (lo mismo para todos)

Para cada fila de las tablas del paso 6:

1. **Inventario → Catálogo → Nuevo producto**
   - **Nombre**, **Categoría**, **Cierre** / **Corte** y **Código del modelo** como dice la tabla. **Despacho:** "Inmediato y bajo pedido" (todos). **Géneros:** en las **filipinas** marca **Dama** y **Caballero**; en lo demás no marques ninguno. **Mano de obra:** vacío (o el costo por pieza, si lo sabes; solo afecta el margen).
   - **Crear y seguir** → te lleva a la página del producto.
2. **Variantes → Colores × tallas**: deja marcados los géneros (en filipinas, Dama y Caballero), marca los colores de la tabla y las tallas (si lleva) → **Crear hasta N variantes**. Revisa que los SKU salgan como el ejemplo de la tabla.
3. **Precios**: el mismo precio en **Pago móvil, Efectivo, Zelle y USDT** → **Guardar precios**.
4. **Fotos** (opcional): **Agregar fotos** (JPG, PNG o WEBP, hasta 8 MB). Asigna cada foto a su color y marca una como principal.

> **Despacho "Inmediato y bajo pedido"**: se vende de lo que hay en stock y, si no alcanza, se hace como pedido. Así todos reciben carga inicial (paso 7) y también se pueden pedir cuando se acaban.

---

## Paso 6 · Productos

Tallas de filipinas: **S, M, L, XL, 2XL, 3XL, 4XL, 5XL y 6XL**. Hasta 2XL cuestan el precio de la tabla; las tallas grandes suman un recargo distinto para dama y caballero (paso 6b).

Cada filipina es **un solo producto** con variantes de **Dama** y de **Caballero**: el SKU lleva la letra del género después del modelo (`C` caballero, `D` dama). Los ejemplos de abajo son de caballero; los de dama cambian la `C` por `D` (`FIL-MC-D-BR-NEG-S`). La cantidad de variantes ya cuenta los dos géneros.

> **Si ya habías creado filipinas sin género** (antes de esta actualización): al actualizar, las que todavía no tenían stock ni ventas pasan solas a Dama y Caballero (las que tenías quedan de Caballero y se crean las de Dama). No hace falta volver a crearlas.

### Filipinas manga corta · $45 · Código del modelo `MC`

- [ ] **Filipina manga corta broche** · Cierre: Broche · Colores: Negro, Vinotinto, Verde militar, Azul marino, Gris plomo, Kaki · 108 variantes · SKU ej.: `FIL-MC-C-BR-NEG-S`
- [ ] **Filipina manga corta botón** · Cierre: Botones · Colores: Blanco, Negro, Gris hércules, Azul marino, Verde militar, Vinotinto, Kaki · 126 variantes · SKU ej.: `FIL-MC-C-BO-BLA-S`
- [ ] **Filipina manga corta cierre** · Cierre: Cierre · Colores: Blanco, Negro, Gris hércules, Azul marino, Verde militar, Vinotinto, Kaki · 126 variantes · SKU ej.: `FIL-MC-C-CI-BLA-S`

### Filipinas manga 3/4 · $49 · Código del modelo `M34`

- [ ] **Filipina manga 3/4 broche** · Cierre: Broche · Colores: Negro, Vinotinto, Verde militar, Azul marino, Kaki · 90 variantes · SKU ej.: `FIL-M34-C-BR-NEG-S`
- [ ] **Filipina manga 3/4 botón** · Cierre: Botones · Colores: Blanco, Negro, Vinotinto, Verde militar, Azul marino, Kaki · 108 variantes · SKU ej.: `FIL-M34-C-BO-BLA-S`
- [ ] **Filipina manga 3/4 cierre** · Cierre: Cierre · Colores: Negro, Blanco, Gris plomo, Vinotinto, Verde militar, Azul marino, Kaki · 126 variantes · SKU ej.: `FIL-M34-C-CI-NEG-S`

### Filipinas manga larga · $49 · Código del modelo `ML`

- [ ] **Filipina manga larga broche** · Cierre: Broche · Colores: Negro, Vinotinto, Verde militar, Azul marino, Kaki · 90 variantes · SKU ej.: `FIL-ML-C-BR-NEG-S`
- [ ] **Filipina manga larga botón** · Cierre: Botones · Colores: Blanco, Negro, Vinotinto, Verde militar, Azul marino, Kaki · 108 variantes · SKU ej.: `FIL-ML-C-BO-BLA-S`
- [ ] **Filipina manga larga cierre** · Cierre: Cierre · Colores: Negro, Blanco, Gris plomo, Vinotinto, Verde militar, Azul marino, Kaki · 126 variantes · SKU ej.: `FIL-ML-C-CI-NEG-S`

### Pantalones · sin código de modelo (el corte ya los distingue)

Pata de gallo es un **color** más del pantalón, con un **recargo de +$2** (paso 6b). **Tallas:** las que de verdad usan (créalas en el paso 3 si faltan); en el SKU van al final: `PAN-RE-NEG-M`.

- [ ] **Pantalón de cocina recto** · Corte: Recto · Colores: Negro, Gris, Pata de gallo · **$25** (pata de gallo: $27 con el recargo) · SKU ej.: `PAN-RE-NEG-M`, `PAN-RE-PDG-M`
- [ ] **Pantalón jogger** · Corte: Jogger · Colores: Negro, Gris, Pata de gallo · **$27** (pata de gallo: $29 con el recargo) · SKU ej.: `PAN-JG-NEG-M`, `PAN-JG-PDG-M`

### Estuches para cuchillos · sin tallas

Colores (borde) de los tres: Negro, Gris, Morado, Naranja, Verde neón, Dorado, Azul eléctrico, Fucsia, Rosa · 9 variantes cada uno.

- [ ] **Estuche Maxi** · Código del modelo `MAXI` · **$35** · SKU ej.: `EST-MAXI-MOR`
- [ ] **Estuche Stark** · Código del modelo `STARK` · **$30** · SKU ej.: `EST-STARK-MOR`
- [ ] **Estuche Pocket** · Código del modelo `POCKET` · **$25** · SKU ej.: `EST-POCKET-MOR`

### Delantales · sin tallas

- [ ] **Delantal clásico** · Código del modelo `CLA` · Colores: Negro, Kaki, Gris plomo, Azul eléctrico · **$15** · SKU ej.: `DEL-CLA-NEG`
- [ ] **Delantal de servicio** · Código del modelo `SERV` · Colores: Negro, Gris plomo, Azul eléctrico, Kaki, Blanco · **$10** · SKU ej.: `DEL-SERV-NEG`
- [ ] **Delantal denim** (la tela es denim) · Código del modelo `DENIM` · Colores: Negro, Gris plomo, Azul eléctrico, Kaki, Blanco · **$25** · SKU ej.: `DEL-DENIM-NEG`

### Gorros · sin tallas

Colores de los tres: Negro, Gris plomo, Azul eléctrico, Kaki, Blanco · 5 variantes cada uno · **$7**.

- [ ] **Gorro inglés** · Código del modelo `ING` · SKU ej.: `GOR-ING-NEG`
- [ ] **Gorro sushero** · Código del modelo `SUSH` · SKU ej.: `GOR-SUSH-NEG`
- [ ] **Bandana clásica** · Código del modelo `BAND` · SKU ej.: `GOR-BAND-NEG`

---

## Paso 6b · Recargos: tallas grandes y pata de gallo

Las tallas grandes cuestan distinto según el género: **caballero** suma **$3 por cada talla** desde la 3XL (3XL +$3, 4XL +$6, 5XL +$9, 6XL +$12) y **dama** cuesta lo mismo hasta la 5XL y solo la **6XL** suma un recargo. Se cargan en la página de cada filipina:

1. Abre la filipina → sección **Precio por talla** (una tabla de tallas × Dama / Caballero).
2. En la fila de arriba (el atajo): **Caballero** · desde **3XL** · **+$ 3** por talla → **Llenar**. Se llenan 3XL a 6XL con 3, 6, 9 y 12.
3. Atajo otra vez: **Dama** · desde **6XL** · **+$ (el recargo de la 6XL)** → **Llenar**.
4. **Guardar precio por talla.** Debajo de cada monto se ve el precio final (ej.: "= $ 48,00").
5. Repite en cada filipina.

- [ ] Precio por talla cargado en las 9 filipinas.

> **Configuración → Tallas → Recargo** sigue sirviendo para cargar un recargo **igual para todos los géneros** en muchos productos a la vez. Lo que cargues por género en la página del producto manda sobre ese.

Y con los pantalones ya creados:

4. **Configuración → Colores** → en la fila de **Pata de gallo**, toca **Recargo**.
5. En **Pantalones**, toca **Marcar todos**, escribe **2** en **Mismo monto para los marcados** → **Aplicar** → **Guardar recargos**.

- [ ] Recargo de +$2 en Pata de gallo para los dos pantalones.

> Si un pantalón pata de gallo es además de una talla con recargo, se suman los dos.

> El recargo se suma al precio en todos los métodos (en Pago móvil, convertido a Bs con la tasa del día). En la página de cada producto, la tabla **Precio por talla** muestra los de talla y, debajo de **Precios**, "Recargo por color: Pata de gallo +$ 2,00". La calculadora lo avisa debajo del producto.

---

## Paso 7 · Carga inicial de stock

Todos los productos son "Inmediato y bajo pedido", así que todos pueden recibirla. Se hace **una sola vez por variante**; después, los cambios van con ajustes.

1. Abre `docs/plantilla-carga-inicial.csv` (en Excel o Google Sheets). Ya trae **todos los SKU** de esta guía (filipinas de S a 6XL, primero las de caballero y después las de dama), sin pantalones porque faltan sus tallas.
2. Llena **cantidad** con lo que hay hoy y, si lo sabes, **costo_usdt** (costo por pieza en USDT; define el costo inicial y el margen).
3. **Borra las filas sin stock**: una fila con cantidad vacía o en 0 detiene toda la carga.
4. Agrega las filas de los pantalones con sus tallas (ej.: `PAN-RE-NEG-M;10;12,50`).
5. **Inventario → Stock → Carga inicial**: pega el contenido o **Subir archivo .csv** → **Revisar** → **Confirmar carga inicial**.

- [ ] Carga inicial confirmada.

> Si **Revisar** marca un SKU que no existe, compáralo con el de la página del producto (por ejemplo, si un color quedó con otro código). Corrige la fila, no el producto.

---

## Paso 8 · Revisión final

- [ ] **Comercial → Calculadora**: toca un par de productos y confirma que los totales salen bien en Bs y en USD.
- [ ] **Inventario → Stock**: las cantidades coinciden con lo que hay.
- [ ] Cada producto tiene precio en los 4 métodos (si falta alguno, la venta avisa "Sin precio").

---

## Pendiente

1. **Tallas de los pantalones.** No están en la lista: créalas en el paso 3 si faltan, úsalas en **Colores × tallas** y agrega sus filas a la carga inicial (`PAN-RE-NEG-<talla>`, `PAN-RE-GRI-<talla>`, `PAN-RE-PDG-<talla>`, `PAN-JG-NEG-<talla>`, `PAN-JG-GRI-<talla>`, `PAN-JG-PDG-<talla>`; son 2 productos con 3 colores cada uno).
2. **Combos y personalización** (bordados, logos): no están en la lista. Se configuran después, en **Inventario → Combos** y **Configuración → Pedidos y personalización**.

Confirmado: kaki existe en manga 3/4 y larga con broche; el delantal denim lleva los mismos cinco colores que el de servicio; el **Gris** de pantalones y estuches es distinto del gris plomo; todo se despacha **inmediato y bajo pedido**.
