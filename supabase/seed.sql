-- WordiX · 02 · Datos iniciales del diccionario
-- Requiere haber ejecutado 01_diccionario_schema.sql.
-- Se puede ejecutar varias veces: los duplicados se ignoran.

create or replace function public.wordix_seed(p_slug text, p_words text[])
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  insert into public.word_dictionary (category_id, word, source)
  select c.id, w, 'seed'
  from public.categories c, unnest(p_words) as w
  where c.slug = p_slug
  on conflict (category_id, word_normalized) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ANIMALES
select public.wordix_seed('animal', array[
 'perro','gato','caballo','vaca','cerdo','oveja','cabra','gallina','gallo','pato',
 'ganso','pavo','conejo','burro','mula','toro','buey','llama','alpaca','camello',
 'elefante','jirafa','león','tigre','leopardo','jaguar','puma','pantera','guepardo','lobo',
 'zorro','oso','panda','koala','canguro','mono','gorila','chimpancé','orangután','hipopótamo',
 'rinoceronte','cebra','ciervo','venado','alce','jabalí','nutria','castor','ardilla','ratón',
 'rata','hámster','erizo','murciélago','delfín','ballena','tiburón','orca','foca','morsa',
 'pingüino','pulpo','calamar','medusa','cangrejo','langosta','camarón','pez','salmón','atún',
 'trucha','sardina','tortuga','cocodrilo','caimán','iguana','lagarto','serpiente','cobra','víbora',
 'boa','anaconda','rana','sapo','salamandra','águila','halcón','búho','lechuza','loro',
 'guacamayo','tucán','colibrí','paloma','gorrión','canario','cisne','flamenco','pelícano','avestruz',
 'cóndor','abeja','hormiga','mariposa','mosca','mosquito','araña','escorpión','libélula','saltamontes',
 'cucaracha','caracol','lombriz','mapache','tapir','armadillo','perezoso','capibara','ñu','ñandú',
 'quetzal','urraca','yak','zorrillo','jilguero','kiwi','wombat','xoloitzcuintle','iguana verde','oso polar',
 'oso hormiguero','estrella de mar','caballito de mar','gato montés','lobo marino'
]);

-- NOMBRES
select public.wordix_seed('nombre', array[
 'juan','carlos','josé','luis','miguel','pedro','jorge','andrés','david','daniel',
 'santiago','sebastián','mateo','nicolás','alejandro','felipe','camilo','diego','fernando','javier',
 'ricardo','roberto','manuel','antonio','francisco','eduardo','alberto','sergio','pablo','rafael',
 'óscar','héctor','iván','julián','mauricio','esteban','gabriel','samuel','tomás','emilio',
 'hugo','martín','simón','bruno','adrián','álvaro','víctor','raúl','enrique','jaime',
 'maría','ana','laura','sofía','valentina','camila','daniela','carolina','andrea','paula',
 'natalia','juliana','isabella','mariana','luisa','lucía','martina','gabriela','alejandra','catalina',
 'carmen','rosa','patricia','claudia','diana','sandra','mónica','sara','elena','paola',
 'verónica','angélica','adriana','beatriz','cristina','fernanda','jimena','karen','lina','melissa',
 'nora','olga','pilar','rocío','silvia','teresa','úrsula','viviana','ximena','yolanda',
 'zoe','kevin','walter','yeison','zacarías','ñusta','ulises','xavier','yago'
]);

-- APELLIDOS
select public.wordix_seed('apellido', array[
 'garcía','rodríguez','martínez','lópez','gonzález','hernández','pérez','sánchez','ramírez','torres',
 'flores','rivera','gómez','díaz','reyes','morales','cruz','ortiz','gutiérrez','chávez',
 'ramos','ruiz','mendoza','aguilar','castillo','jiménez','vargas','castro','romero','álvarez',
 'suárez','herrera','medina','vásquez','fernández','guerrero','rojas','silva','cortés','moreno',
 'delgado','ríos','navarro','domínguez','soto','vega','campos','núñez','peña','salazar',
 'ortega','cardona','giraldo','restrepo','ospina','muñoz','parra','quintero','zapata','yepes',
 'ibarra','luna','bravo','acosta','benítez','cabrera','duarte','escobar','fuentes','guzmán',
 'hidalgo','juárez','lara','maldonado','nieto','ocampo','pacheco','quiroga','rangel','serrano',
 'tapia','uribe','valencia','ximénez','zambrano','arango','bolaños','correa','durán','espinosa',
 'franco','gallego','henao','jaramillo','londoño','mejía','naranjo','osorio','patiño','rendón',
 'sierra','trujillo','urrego','villa','zuluaga','ñáñez','yáñez','wilches','quesada'
]);

-- PAÍSES Y CIUDADES (lista 1: ciudades)
select public.wordix_seed('pais_ciudad', array[
 'bogotá','medellín','cali','barranquilla','cartagena','bucaramanga','cúcuta','pereira','manizales','santa marta',
 'ibagué','pasto','villavicencio','armenia','montería','neiva','popayán','valledupar','tunja','sincelejo',
 'madrid','barcelona','valencia','sevilla','zaragoza','málaga','bilbao','granada','toledo','salamanca',
 'ciudad de méxico','guadalajara','monterrey','puebla','cancún','tijuana','mérida','buenos aires','córdoba','rosario',
 'mendoza','lima','cusco','arequipa','santiago','valparaíso','quito','guayaquil','cuenca','caracas',
 'maracaibo','la paz','sucre','montevideo','asunción','la habana','santo domingo','san juan','panamá','san josé',
 'tegucigalpa','guatemala','managua','san salvador','lisboa','oporto','parís','londres','roma','milán',
 'venecia','berlín','múnich','ámsterdam','bruselas','viena','praga','atenas','moscú','estambul',
 'el cairo','nairobi','dubái','tokio','kioto','osaka','pekín','shanghái','seúl','bangkok',
 'singapur','sídney','melbourne','nueva york','los ángeles','chicago','miami','houston','toronto','montreal',
 'vancouver','río de janeiro','sao paulo','brasilia','kingston','quebec','xalapa','zacatecas','ushuaia','yopal',
 'jerusalén','varsovia','oslo','helsinki','dublín','budapest','zúrich','ginebra','nápoles','florencia'
]);

-- PAÍSES Y CIUDADES (lista 2: países)
select public.wordix_seed('pais_ciudad', array[
 'colombia','méxico','argentina','brasil','chile','perú','ecuador','venezuela','bolivia','uruguay',
 'paraguay','panamá','costa rica','nicaragua','honduras','el salvador','guatemala','cuba','república dominicana','puerto rico',
 'españa','portugal','francia','italia','alemania','inglaterra','reino unido','irlanda','holanda','países bajos',
 'bélgica','suiza','austria','suecia','noruega','finlandia','dinamarca','polonia','grecia','turquía',
 'rusia','ucrania','china','japón','corea del sur','corea del norte','india','tailandia','vietnam','indonesia',
 'filipinas','australia','nueva zelanda','canadá','estados unidos','egipto','marruecos','sudáfrica','nigeria','kenia',
 'etiopía','argelia','túnez','arabia saudita','israel','irán','irak','pakistán','jamaica','haití',
 'islandia','hungría','rumania','croacia','serbia','qatar','uganda','zambia','yemen','nepal'
]);

-- FRUTAS
select public.wordix_seed('fruta', array[
 'manzana','pera','naranja','mandarina','limón','lima','toronja','plátano','banano','uva',
 'fresa','mora','frambuesa','arándano','cereza','ciruela','durazno','melocotón','albaricoque','mango',
 'papaya','piña','sandía','melón','kiwi','coco','guayaba','maracuyá','granadilla','lulo',
 'mamey','chirimoya','guanábana','higo','granada','aguacate','tomate de árbol','zapote','níspero','nuez',
 'tamarindo','pitaya','borojó','curuba','uchuva','membrillo','dátil','carambola','litchi'
]);

-- COLORES
select public.wordix_seed('color', array[
 'rojo','azul','verde','amarillo','naranja','morado','violeta','rosa','rosado','blanco',
 'negro','gris','café','marrón','beige','dorado','plateado','celeste','turquesa','fucsia',
 'magenta','cian','lila','añil','carmesí','escarlata','vino','oliva','crema','ocre',
 'khaki','zafiro','esmeralda','ámbar','índigo','granate','lavanda','coral','bronce'
]);

-- COMIDAS
select public.wordix_seed('comida', array[
 'arroz','frijoles','pasta','pizza','hamburguesa','sándwich','sopa','ensalada','pollo','carne',
 'pescado','huevo','pan','queso','jamón','salchicha','tortilla','taco','burrito','empanada',
 'arepa','tamal','paella','lasaña','espagueti','ceviche','sushi','hot dog','papas fritas','tostada',
 'lentejas','garbanzos','sancocho','bandeja paisa','ajiaco','pozole','enchilada','quesadilla','nachos','croqueta',
 'tortilla española','gazpacho','churro','helado','pastel','galleta','chocolate','yuca','plátano frito','wafle'
]);

-- OBJETOS
select public.wordix_seed('objeto', array[
 'mesa','silla','cama','sofá','lámpara','espejo','reloj','teléfono','computador','televisor',
 'libro','cuaderno','lápiz','esfero','borrador','regla','tijeras','mochila','llave','puerta',
 'ventana','cuchara','tenedor','cuchillo','plato','vaso','taza','olla','sartén','botella',
 'zapato','camisa','pantalón','sombrero','gafas','paraguas','maleta','cámara','guitarra','balón',
 'bicicleta','carro','martillo','destornillador','escoba','almohada','cobija','ventilador','nevera','yoyo'
]);

-- PROFESIONES
select public.wordix_seed('profesion', array[
 'médico','enfermero','abogado','ingeniero','arquitecto','profesor','maestro','contador','psicólogo','dentista',
 'veterinario','farmacéutico','cocinero','chef','mesero','panadero','carnicero','agricultor','pescador','carpintero',
 'albañil','electricista','plomero','mecánico','soldador','pintor','escritor','periodista','actor','cantante',
 'músico','bailarín','fotógrafo','diseñador','programador','piloto','conductor','policía','bombero','militar',
 'juez','fiscal','secretario','vendedor','cajero','peluquero','zapatero','jardinero','químico','ilustrador'
]);

-- PELÍCULAS, SERIES Y CARICATURAS
select public.wordix_seed('pelicula', array[
 'titanic','avatar','shrek','frozen','coco','up','cars','ratatouille','wall e','intensamente',
 'moana','encanto','mulán','aladdín','bambi','dumbo','pinocho','el rey león','la bella y la bestia','la sirenita',
 'toy story','buscando a nemo','los increíbles','monsters inc','madagascar','kung fu panda','rápidos y furiosos','harry potter','el señor de los anillos','star wars',
 'jurassic park','matrix','gladiador','rocky','rambo','terminator','volver al futuro','indiana jones','batman','superman',
 'spiderman','los vengadores','iron man','thor','capitán américa','pantera negra','aquaman','joker','forrest gump','el padrino',
 'casablanca','psicosis','tiburón','el exorcista','scream','zootopia','x men','karate kid','hannah montana','los juegos del hambre',
 'friends','los simpson','padre de familia','south park','breaking bad','game of thrones','stranger things','la casa de papel','narcos','el chavo del ocho',
 'el chapulín colorado','yo soy betty la fea','el patrón del mal','sin tetas no hay paraíso','el señor de los cielos','la reina del sur','la rosa de guadalupe','rebelde','patito feo','casi ángeles',
 'floricienta','violetta','icarly','drake y josh','zack y cody','kenan y kel','xena la princesa guerrera','bob esponja','dragon ball','naruto',
 'pokémon','los pitufos','tom y jerry','mickey mouse','pato donald','bugs bunny','el correcaminos','scooby doo','los picapiedra','los supersónicos',
 'rick y morty','hora de aventura','steven universe','ben diez','las chicas superpoderosas','el laboratorio de dexter','johnny bravo','vaca y pollito','coraje el perro cobarde','los padrinos mágicos',
 'jimmy neutrón','rugrats','peppa pig','pocoyó','dora la exploradora','bluey','patrulla canina','la granja de zenón','los thundercats','he man',
 'los caballeros del zodiaco','sailor moon','digimon','yu gi oh','one piece','bleach','ataque a los titanes','death note','demon slayer','my hero academia'
]);

-- PARTES DEL CUERPO
select public.wordix_seed('cuerpo', array[
 'cabeza','cara','pelo','cabello','frente','ceja','ojo','pestaña','nariz','boca',
 'labio','lengua','diente','muela','oreja','oído','mejilla','barbilla','mentón','cuello',
 'garganta','hombro','brazo','codo','muñeca','mano','dedo','pulgar','índice','uña',
 'palma','pecho','espalda','columna','costilla','corazón','pulmón','hígado','riñón','estómago',
 'intestino','vejiga','cerebro','cintura','cadera','abdomen','ombligo','ingle','nalga','pierna',
 'muslo','rodilla','pantorrilla','tobillo','pie','talón','planta','hueso','músculo','piel',
 'sangre','vena','arteria','nervio','cráneo','tendón','ligamento','páncreas','esófago','tráquea',
 'paladar','amígdala','pómulo','sien','nuca','axila','tórax','vértebra','clavícula','fémur',
 'tibia','peroné','húmero','pelvis','esternón','omóplato','rótula','xifoides','yugular','bíceps',
 'tríceps','glúteo','diafragma','retina','pupila','córnea','tímpano','cordón umbilical','dedo del pie','codo'
]);

-- PERSONAJES (de ficción)
select public.wordix_seed('personaje', array[
 'mario','luigi','sonic','pikachu','goku','vegeta','naruto','luffy','homero','bart',
 'lisa','marge','bob esponja','patricio','calamardo','don cangrejo','mickey','minnie','donald','goofy',
 'pluto','bugs bunny','pato lucas','piolín','silvestre','tom','jerry','scooby','shaggy','popeye',
 'superman','batman','robin','joker','spiderman','hulk','thor','iron man','capitán américa','viuda negra',
 'wolverine','deadpool','thanos','darth vader','yoda','luke skywalker','leia','han solo','chewbacca','harry potter',
 'hermione','ron','dumbledore','voldemort','gandalf','frodo','aragorn','legolas','gollum','shrek',
 'fiona','simba','mufasa','scar','timón','pumba','elsa','anna','olaf','woody',
 'buzz lightyear','nemo','dory','marlin','mike wazowski','sulley','mulán','aladdín','jasmín','ariel',
 'cenicienta','blancanieves','pinocho','peter pan','campanita','capitán garfio','don quijote','sancho panza','zorro','tarzán',
 'drácula','frankenstein','sherlock holmes','robin hood','el chavo','quico','don ramón','la chilindrina','doña florinda','el chapulín colorado',
 'pocoyó','peppa','dora','bluey','kratos','link','zelda','kirby','donkey kong','bowser',
 'yoshi','lara croft','mega man','pac man','xena','ñoño','kenny','cartman','stewie','rick'
]);

-- CANCIONES
select public.wordix_seed('cancion', array[
 'despacito','bailando','vivir mi vida','la bicicleta','waka waka','gasolina','hawái','mi gente','danza kuduro','la camisa negra',
 'ojos así','bésame mucho','cielito lindo','la bamba','guantanamera','el rey','volver volver','las mañanitas','color esperanza','rayando el sol',
 'eres','de música ligera','persiana americana','lamento boliviano','la flaca','mala vida','clandestino','me gustas tú','la tortura','ojalá',
 'corazón partío','a dios le pido','si no te hubieras ido','tusa','bichota','provenza','pepas','dákiti','yonaguni','safaera',
 'callaíta','tití me preguntó','ella baila sola','me porto bonito','ojitos lindos','efecto','moscow mule','perro negro','baila baila baila','la gozadera',
 'suavemente','burbujas de amor','devuélveme a mi chica','propuesta indecente','obsesión','darte un beso','limón y sal','no me ames',
 'mi tierra','yo te esperaré','bohemian rhapsody','imagine','yesterday','thriller','billie jean','shape of you','perfect','havana',
 'believer','hello','someone like you','let it be','hey jude','stairway to heaven','smells like teen spirit','wonderwall','bad guy','blinding lights',
 'shallow','uptown funk','titanium','zombie','yellow','kiss','karma chameleon','wannabe','macarena','la copa de la vida',
 'adiós amor','amor eterno','la cucaracha','hasta que te conocí','vivo por ella'
]);

-- DEPORTES
select public.wordix_seed('deporte', array[
 'fútbol','baloncesto','béisbol','tenis','voleibol','natación','atletismo','ciclismo','boxeo','golf',
 'rugby','hockey','balonmano','patinaje','esgrima','judo','karate','taekwondo','lucha libre','lucha',
 'gimnasia','halterofilia','levantamiento de pesas','remo','vela','surf','esquí','snowboard','escalada','montañismo',
 'senderismo','equitación','polo','tiro con arco','tiro deportivo','billar','bolos','ajedrez','dardos','pádel',
 'squash','bádminton','tenis de mesa','ping pong','triatlón','maratón','salto de altura','salto largo','lanzamiento de jabalina','lanzamiento de disco',
 'lanzamiento de bala','decatlón','heptatlón','carrera de obstáculos','automovilismo','motociclismo','fórmula uno','karting','rafting','buceo',
 'waterpolo','nado sincronizado','clavados','skateboarding','bmx','parkour','crossfit','yoga','pilates','aeróbicos',
 'sóftbol','críquet','fútbol americano','fútbol sala','microfútbol','pelota vasca','kickboxing','muay thai','sumo','jiu jitsu',
 'capoeira','wushu','yudo','ultimate','curling','biatlón','trial','skate','patinaje artístico','ciclismo de montaña'
]);

-- Limpieza del helper y resumen de lo cargado
drop function public.wordix_seed(text, text[]);

select c.slug, count(w.id) as palabras
from public.categories c
left join public.word_dictionary w on w.category_id = c.id
group by c.slug
order by c.slug;
