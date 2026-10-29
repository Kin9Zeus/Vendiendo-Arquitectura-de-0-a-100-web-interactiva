/**
 * Contenido del libro. Fuente: recursos_iniciales/Vendiendo_arquitectura_de_0_a_100_FINAL.pdf
 * Los resúmenes parafrasean la apertura de cada capítulo; no reproducen el texto completo.
 */

export const BOOK = {
  title: 'Vendiendo arquitectura de 0 a 100',
  collection: 'Arquitectura Disruptiva',
  volume: 'Tomo 01',
  edition: '2.ª edición',
  author: 'Sebastián Arias Duque',
  authorRole: 'Arquitecto, magíster en Arquitectura y Urbanismo · director y CEO de UVA Arquitectura',
  publisher: 'Editorial UVA',
  city: 'Pereira, Colombia',
  pages: 208,
  format: 'Tapa dura con sobrecubierta',
  size: '21,7 × 15,6 cm',
  isbn: null as string | null, // ISBN por asignar
  firstEdition: 'septiembre de 2023',
  printer: 'Maka Editores',
  motto: 'Lo que nunca nadie nos contó.',
} as const;

export type Chapter = {
  n: number;
  slug: string;
  title: string;
  page: number;
  summary: string;
  ideas: string[];
  isNew?: boolean;
  byline?: string;
};

export const CHAPTERS: Chapter[] = [
  {
    n: 1, page: 19, slug: 'finalidad-de-este-libro', title: 'Finalidad de este libro',
    summary: 'Un interruptor que quizá nunca has encendido: el libro se plantea como una obra didáctica para entender el andamiaje real de una oficina de arquitectura o diseño y aprender a emerger en medio de la crisis.',
    ideas: ['Por qué la academia no prepara para el mercado', 'La arquitectura como servicio que debe venderse', 'Credibilidad y relación con el cliente como base del negocio'],
  },
  {
    n: 2, page: 21, slug: 'despertando-de-las-creencias', title: 'Despertando de las creencias y auto verdades infringidas',
    summary: 'Heredamos maneras de pensar sobre el dinero y el trabajo desde la infancia. Llevadas a la práctica profesional, esas creencias se convierten en dudas e inseguridades que frenan el negocio.',
    ideas: ['La importancia de cuestionarlo todo', 'Cómo lo vivido condiciona nuestras decisiones', 'Separar la herencia familiar de la gestión de la oficina'],
  },
  {
    n: 3, page: 23, slug: 'apertura-de-oficina', title: 'Apertura de oficina: ¿qué conlleva crear una marca de arquitectura o diseño?',
    summary: 'Abrir una oficina es resolver lo que nadie nos enseñó a resolver: registro de empresa, facturación electrónica, factores fundamentales de la marca y un seguimiento económico mes a mes de ingresos, egresos y balance.',
    ideas: ['Registro de empresa y facturación electrónica', 'Factores fundamentales al abrir una oficina-marca', 'Modelo de seguimiento económico de UVA'],
  },
  {
    n: 4, page: 33, slug: 'la-intuicion', title: 'La intuición',
    summary: 'Hay millones de técnicas, pero en las decisiones económicas siempre aparece la intuición. El capítulo la propone como filtro para elegir qué proyectos aceptar y cuáles rechazar.',
    ideas: ['La intuición como fuente de decisión', '¿Por qué elegimos proyectos que no son viables?', 'Costo-beneficio antes de decir que sí'],
  },
  {
    n: 5, page: 35, slug: 'mercado-agresivo-y-cambiante', title: '¿Cómo ingresar y establecerse en un mercado agresivo y cambiante?',
    summary: 'El mercado cambió con las crisis inmobiliarias, la tecnología y las redes, pero muchas oficinas siguen vendiendo como hace veinte años. El portafolio impreso y el volante quedaron obsoletos.',
    ideas: ['Pensar el mercado desde el consumidor', 'Tráfico digital + voz a voz', 'Qué prácticas comerciales abandonar hoy'],
  },
  {
    n: 6, page: 39, slug: 'como-cotizar-un-diseno', title: '¿Cómo debe cotizarse un diseño arquitectónico que tenga altas posibilidades de ser aprobado?',
    summary: 'Un negocio puede concretarse o perderse en la propuesta escrita. El capítulo desarma una cotización real del archivo UVA y los factores psicológicos que elevan su aprobación.',
    ideas: ['El modelo de propuesta técnica y económica de UVA', 'Detalles psicológicos que influyen en la aprobación', 'Dos terminologías que confunden al cliente'],
  },
  {
    n: 7, page: 47, slug: 'tipos-de-contratos-de-obra', title: 'Tipos de contratos en la construcción de un proyecto, obra civil',
    summary: 'La etapa constructiva concentra las utilidades más grandes de un proyecto. Antes de proponer un contrato hay que leer el tamaño, el riesgo y el cliente.',
    ideas: ['Todo costo / llave en mano, administración delegada, AIU y asesorías', 'Cómo se compone un contrato por AIU', 'Qué cobra, qué responde y con qué tener cuidado en cada uno'],
  },
  {
    n: 8, page: 57, slug: 'contratos-para-empleados', title: 'Tipo de contrato para empleados de nuestras oficinas o empresas',
    summary: 'Todo vínculo laboral se trata con extrema seriedad. Además de los tipos de contrato, el capítulo aborda la administración financiera de la oficina y cuánto cobrar por metro cuadrado según la tipología.',
    ideas: ['Contratos de prueba y vínculos formales desde el día uno', 'Los «no negociables» de una empresa de diseño y construcción', 'Valor tentativo del m² de diseño por tipo de proyecto'],
  },
  {
    n: 9, page: 97, slug: 'entregables', title: 'Entregables, el tipo de proyecto que debe recibir el cliente en todas sus etapas de desarrollo',
    summary: '¿Hemos estado entregando bien los proyectos? La respuesta del libro es no: el cliente no lee planos. La entrega ideal se apoya en BIM y en niveles de detalle (LOD) claros.',
    ideas: ['Por qué el «anteproyecto» le hace daño a la profesión', 'Entrega ideal con metodología BIM', 'Niveles de desarrollo LOD 100 a 500 y el estándar UVA'],
  },
  {
    n: 10, page: 99, slug: 'correcciones', title: 'Correcciones, el talón de Aquiles de todos los proyectos a nivel de diseño',
    summary: '¿Cuántas veces se corrige un proyecto? El capítulo lo responde desde el flujo de caja: cada corrección sin límite consume horas que nadie está cobrando.',
    ideas: ['Flujos de caja en el diseño', 'Tiempo de diseño contra gasto real de oficina', 'Cómo limitar correcciones sin perder al cliente'],
  },
  {
    n: 11, page: 103, slug: 'visualizacion', title: 'Visualización en un proyecto de arquitectura y sus entregables',
    summary: 'Lumion, 3ds Max, Twinmotion, Unreal: la calidad de la visualización depende tanto del software como de quien lo usa. Por eso debe definirse, entregarse y cobrarse aparte.',
    ideas: ['Cuánto vale la visualización', 'Por qué se cobra por separado', 'Cómo alinearla con el nivel de detalle del proyecto'],
  },
  {
    n: 12, page: 107, slug: 'estrategias-de-mercadeo', title: 'Estrategias de mercadeo para arquitectos, diseñadores y constructores',
    summary: 'No basta con ser buen profesional: hay que saber perfilar a un cliente y venderle el proyecto. El libro propone tres estrategias cognitivas que funcionan con clientes reales.',
    ideas: ['Marketing del miedo', 'Ley de escasez', 'Familiaridad y relación personal'],
  },
  {
    n: 13, page: 115, slug: 'regalar-el-trabajo', title: '¿Regalar el trabajo al inicio a cambio de portafolio?',
    summary: 'Una postura polémica contada desde la experiencia: cómo «regalar» el trabajo, en sentido metafórico, al comienzo dio estabilidad rápida a la oficina en 2013 y construyó un portafolio real.',
    ideas: ['Proyectos diseñados y construidos para mostrar', 'Registro fotográfico y audiovisual como herramienta de venta', 'Cuándo dejar de hacerlo'],
  },
  {
    n: 14, page: 119, slug: 'falsas-creencias', title: 'Funcionamiento de las falsas creencias',
    summary: 'Somos esclavos de creencias heredadas que generan conflictos con el dinero. El capítulo propone mirarlas desde afuera y cambiar los hábitos que las sostienen.',
    ideas: ['La herencia generacional y el dinero', 'Ver el mundo desde una zona externa', 'Cambiar los hábitos'],
  },
  {
    n: 15, page: 129, slug: 'la-marca-en-la-arquitectura', title: 'La marca en la arquitectura',
    summary: 'La marca es el alma de una oficina. Una de las fallas más comunes es una marca desconectada de la estrategia y de la esencia del estudio.',
    ideas: ['La marca como experiencia entre oferta y demanda', 'Qué aprender de las grandes marcas', 'El constante cambio'],
  },
  {
    n: 16, page: 137, slug: 'el-riesgo-positivo', title: 'El riesgo positivo de la arquitectura',
    summary: 'A partir de un libro que el autor leyó a los quince años, el capítulo plantea el riesgo como herramienta de decisión y expone lo que la academia nunca cuenta.',
    ideas: ['Riesgo positivo aplicado a la oficina', 'Entregar la incertidumbre', 'La verdad que los académicos no exponen'],
  },
  {
    n: 17, page: 147, slug: 'facturar-no-es-ganar', title: 'Facturar no es ganar', isNew: true, byline: 'Por Davidsson Gonzalez',
    summary: 'Una oficina puede estar llena de proyectos y al mismo tiempo desangrándose. Este capítulo nuevo propone la escalera financiera de 0 a 100 para que los proyectos que ya sabemos vender dejen dinero de verdad.',
    ideas: ['El salario del arquitecto desde el día uno', 'Costo hora: el proyecto «exitoso» que en realidad perdió', 'La caja manda y decidir con datos cada lunes'],
  },
  {
    n: 18, page: 155, slug: 'inteligencia-artificial-claude', title: 'La inteligencia artificial aplicada a la arquitectura: presupuestos, obra y clientes con Claude', isNew: true, byline: 'Por Aleck Martínez',
    summary: 'La experiencia del Diplomado en Claude IA para Presupuestos y Administración de Obra de UVA llevada al papel: de las bases de la herramienta al presupuesto, el control de obra, los contratos y el cobro.',
    ideas: ['La escalera de madurez y el método RCTFR para pedir bien', 'De la foto de obra a la cotización formal', 'Skills, proyectos y una ruta de 30 días'],
  },
  {
    n: 19, page: 195, slug: 'conclusiones-finales', title: 'Conclusiones finales',
    summary: 'La universidad forma para hacer buena arquitectura, pero casi nunca habla de mercado. El cierre insiste en romper el tabú de cuánto cobrar y cómo sostener una oficina.',
    ideas: ['El vacío económico en la formación', 'Cobrar honorarios correctos sin culpa', 'Un final que funciona como inicio'],
  },
];

export const chapterNum = (n: number) => String(n).padStart(2, '0');

/** Lo que encontrarás — contraportada del libro. */
export const FINDINGS = [
  { k: 'Marca', t: 'Qué conlleva abrir una marca de arquitectura o diseño', d: 'Y por qué «menos es más» también aplica al negocio.', ch: 3 },
  { k: 'Cotización', t: 'Una cotización con altas posibilidades de ser aprobada', d: 'Con el modelo real que usa la oficina del autor.', ch: 6 },
  { k: 'Entrega', t: 'La entrega ideal de un proyecto', d: 'Metodología BIM, niveles de detalle y por qué el anteproyecto le hace daño a la profesión.', ch: 9 },
  { k: 'Visualización', t: 'Cuánto vale la visualización', d: 'Y por qué debe cobrarse aparte.', ch: 11 },
  { k: 'Venta', t: 'Tres estrategias cognitivas de venta', d: 'Que funcionan con clientes reales.', ch: 12 },
  { k: 'Creencias', t: 'Las falsas creencias sobre el dinero', d: 'Las que heredamos sobre el dinero y el trabajo, y cómo desactivarlas.', ch: 14 },
  { k: 'Decisión', t: 'Marca, riesgo positivo e intuición', d: 'Como herramientas de decisión.', ch: 16 },
] as const;

/** La escalera financiera de 0 a 100 — capítulo 17. */
export const LADDER = [
  { level: 0, title: 'Todo mezclado', d: 'La cuenta personal y la de la oficina son la misma. Nadie sabe cuánto cuesta abrir la puerta cada mes.' },
  { level: 25, title: 'El salario del arquitecto', d: 'Asignarse un salario desde el día uno. Si el dueño no cobra, la utilidad está inflada.' },
  { level: 50, title: 'De dónde sale la plata', d: 'Separar costos variables de gastos fijos y calcular el costo hora de la oficina.' },
  { level: 75, title: 'La caja manda', d: 'Reservas el mismo día que entra el pago. La forma de cobro pesa tanto como el precio.' },
  { level: 100, title: 'Decidir con datos', d: 'Quince minutos cada lunes: caja disponible, cartera por cobrar y gastos contra presupuesto.' },
] as const;

export const STATS = [
  { value: 15, suffix: '', label: 'años construyendo una oficina real', note: 'aciertos y quiebras contados desde adentro' },
  { value: 19, suffix: '', label: 'capítulos', note: 'dos de ellos nuevos en esta edición' },
  { value: 208, suffix: '', label: 'páginas', note: 'tapa dura con sobrecubierta' },
  { value: 32000, suffix: '+', label: 'personas formadas', note: 'por UVA Academia en Latinoamérica' },
] as const;

export const PEOPLE = [
  { name: 'Arq. Luis Felipe Cuartas Correa', role: 'Prólogo', org: 'Director general, ESA Arquitectura' },
  { name: 'Davidsson Gonzalez', role: 'Capítulo 17 · Facturar no es ganar', org: 'Nuevo en esta edición' },
  { name: 'Aleck Martínez', role: 'Capítulo 18 · IA aplicada a la arquitectura', org: 'Director de desarrollo, UVA' },
] as const;

export const AUTHOR_BIO = [
  'Sebastián Arias Duque es arquitecto y magíster en Arquitectura y Urbanismo. En 2016 fundó UVA Arquitectura (Unidad Vectorial de Arquitectura S.A.S.), oficina de arquitectura, diseño, construcción y editorial con sede en Pereira, Colombia. Es director de UVA Arquitectura y de UVA Academia.',
  'Desde su estudio se dedica al diseño de vivienda, proyectos comerciales y urbanísticos, y al desarrollo de infraestructura hospitalaria. En 2014 obtuvo el segundo lugar en el Concurso de Vivienda Colectiva de ONU-Hábitat, galardonado en Medellín durante el World Urban Forum 7.',
  'Su relación con la arquitectura empezó a los ocho años, construyendo casas con ladrillos a escala en el comedor de su casa. Una década consolidando una oficina, y viendo caer varias otras, lo llevó a enseñar lo que la academia omite: cómo vender, cotizar y administrar la arquitectura.',
] as const;

export const FAQ = [
  {
    q: '¿De qué trata «Vendiendo arquitectura de 0 a 100»?',
    a: 'Es un libro práctico sobre el lado comercial y administrativo de la arquitectura: abrir una oficina, cotizar para que te aprueben, elegir contratos de obra y laborales, definir entregables, limitar correcciones, cobrar la visualización, hacer mercadeo, construir marca y administrar las finanzas. Está escrito desde quince años de experiencia real de UVA Arquitectura en Colombia.',
  },
  {
    q: '¿Para quién es este libro?',
    a: 'Para arquitectos, diseñadores, constructores y estudiantes que quieren dejar de trabajar para sobrevivir y empezar a vivir de su profesión. No exige conocimientos de negocios previos.',
  },
  {
    q: '¿Quién es el autor?',
    a: 'Sebastián Arias Duque, arquitecto y magíster en Arquitectura y Urbanismo, fundador en 2016 de UVA Arquitectura en Pereira, Colombia, y director de UVA Academia, que ha formado a más de 32.000 personas en Latinoamérica.',
  },
  {
    q: '¿Qué hay de nuevo en la segunda edición?',
    a: 'Dos capítulos nuevos: «Facturar no es ganar», sobre administración financiera para que la oficina deje de confundir ingresos con utilidad, y «La inteligencia artificial aplicada a la arquitectura», sobre presupuestos, control de obra y gestión de clientes con Claude.',
  },
  {
    q: '¿El libro incluye algún curso?',
    a: 'Sí. Cada ejemplar incluye acceso gratuito al Curso de Redes Sociales, Mercadeo e Instagram para Arquitectos de UVA Academia. Se accede escaneando el código QR que viene dentro del libro.',
  },
  {
    q: '¿Cómo es el formato físico?',
    a: 'Tapa dura con sobrecubierta, 208 páginas, 21,7 × 15,6 cm, publicado por Editorial UVA e impreso en Colombia.',
  },
  {
    q: '¿Cómo compro el libro?',
    a: 'Escríbenos por WhatsApp desde el botón «Quiero el libro» y te indicamos disponibilidad, precio y envío a tu ciudad.',
  },
] as const;
