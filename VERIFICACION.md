---
sistema: HoP Nola Heart Meter
dominio: codigo
nivel_requerido: 4
nivel_actual: 2
verificar: node verificar.js
revisado: 2026-10-19
fuente: ~/.claude/verificacion/PROTOCOLO.md
---

# Verificación de: HoP Nola Heart Meter

> Archivo generado. No lo edites a mano: cambia `~/.claude/verificacion/registro.tsv`
> y corre `bash ~/.claude/verificacion/propagar.sh`.

## Contrato de este sistema

| | |
|---|---|
| Nivel requerido | **4** |
| Nivel actual | **2** |
| Comando de verificación | `node verificar.js` |
| Última revisión | 2026-10-19 |

**Brecha abierta (2 de 4).** Clasificado el 2026-10-18. Tracker de fundraising de los 17 leaders de HoP Nola 2027: GitHub Pages (jivalare-lab) mas un Google Sheet con Apps Script como backend. Requerido 4 porque los leaders y mentores dependen de los totales para la meta de $2,000 y un error de suma o una fila borrada podria pasar inadvertido; muestra nombres de pila de menores y nombres de donantes a quien tenga el link (noindex y robots.txt, sin correos ni telefonos). Tiene git y verificar.js pasa en verde (sintaxis de la pagina y del Code.gs, ids, noindex, sin guion largo, sin correos ni telefonos), asi que su nivel real es 2. Para el 3 le falta CI; para el 4, pruebas de las reglas criticas del backend (codigo de equipo, montos, borrado) contra una hoja de prueba. Clasificacion inicial del agente, pendiente de que Isaac la confirme.

Mientras la brecha siga abierta, todo agente trabaja al **nivel 2**:
diff completo revisado por Isaac antes de integrar, sin excepciones, por
rápido que pueda escribir. La puerta que manda es la que existe.

Este sistema es de riesgo alto. **Cerrar la brecha va antes que cualquier
función nueva.** No construyas encima de lo que no puedes verificar.

## Protocolo de verificación

Fuente canónica: `~/.claude/verificacion/PROTOCOLO.md`.
Por qué el sistema es así, qué se descartó y qué queda por hacer:
`~/.claude/verificacion/BITACORA.md`. Cómo operarlo y extenderlo: `README.md`.
Este bloque se propaga solo. No lo edites aquí, edita la fuente y corre
`bash ~/.claude/verificacion/propagar.sh`.

### Para qué existe

Un agente de IA puede escribir código o notas más rápido de lo que Isaac puede
leerlos. El único límite honesto a esa velocidad es cuánta verificación
automática existe. Este protocolo fija ese límite por escrito, sistema por
sistema, para que ningún agente vaya más rápido de lo que su red de seguridad
aguanta, y para que ningún sistema cargue con más ceremonia de la que su riesgo
justifica.

### Los dos números

Todo sistema declara dos:

- **`nivel_requerido`**: el que exige su consecuencia. Lo fija el daño posible,
  no la ambición ni el cariño que se le tenga al proyecto.
- **`nivel_actual`**: el que su verificación real sostiene hoy. Se mide, no se
  desea. Si la prueba no existe o no corre, no cuenta.

La distancia entre los dos es la cola de trabajo. Nada más.

### Prueba de consecuencia, para fijar `nivel_requerido`

Responde en orden y quédate con el primer sí.

1. ¿Corre sin nadie mirando, o un error toca a un tercero, dinero, salud, un
   documento legal o datos de un cliente? → **5**
2. ¿Alguien depende del resultado y un error podría pasar inadvertido? → **4**
3. ¿Es público o compartido, y un error se ve pero se arregla? → **3**
4. ¿Es trabajo interno y un error solo cuesta tu propio tiempo? → **2**
5. ¿Es desechable? → **1**

La regla 1 no admite matices. Algo que se ejecuta solo es nivel 5 aunque sea
pequeño, aunque sea personal, aunque «solo mande un mensaje».

### Los niveles

**Nivel 1, borrador.** El agente propone, Isaac lee cada línea.
Puerta: ninguna automática, pero el cambio se ejecuta al menos una vez.

**Nivel 2, ejecutor.** El agente escribe, Isaac revisa el diff completo antes de
integrar.
Puerta: control de versiones + el cambio corre + Isaac aprueba el diff.
Piso duro: sin git no se pasa de nivel 1. Nunca.

**Nivel 3, colaborador verificado.** Isaac revisa el resumen, no cada línea.
Puerta en código: typecheck, build y lint corriendo en CI en cada push. Trabajo
en rama, no directo a `main`.
Puerta en vault: los enlaces resuelven, todo campo consultado por Dataview
existe con ese nombre exacto, y no se creó una segunda fuente de verdad.

**Nivel 4, operador.** El agente trabaja solo en una rama y la puerta decide si
entra.
Puerta: todo lo de nivel 3, más pruebas de las reglas críticas (las que si
fallan devuelven un dato falso en vez de un error), más una comprobación de
arquitectura o de esquema, más una vista previa antes de integrar.
Regla añadida: ninguna ruta de error puede quedarse callada.

**Nivel 5, autónomo con garantía.** El agente publica sin que Isaac mire.
Puerta: todo lo de nivel 4, más prueba contra la dependencia real y no simulada,
más idempotencia verificada corriendo el proceso dos veces, más una alerta que
llega a Isaac cuando falla, más rastro de auditoría, más una reversión probada.

### Regla de eficiencia, en las dos direcciones

- **No inviertas por encima del requerido.** Montar CI, pruebas y alertas en un
  sistema de nivel 2 es gastar el recurso escaso en el lugar equivocado.
- **No operes por encima del actual.** Si `nivel_actual` es 2, el agente trabaja
  como nivel 2 aunque el proyecto exija 5. La velocidad la fija la puerta que
  existe, no la que debería existir. Escribir a ritmo de nivel 4 en un repo con
  puertas de nivel 1 es la forma más cara de trabajar que hay.
- **Donde `nivel_requerido` es 4 o 5, cerrar la brecha va antes que cualquier
  función nueva.** No se construye encima de algo que no se puede verificar.

### Puerta de salida, obligatoria en toda tarea

1. **Declara.** Lee el `VERIFICACION.md` del sistema antes de tocar nada. Si no
   existe, clasifícalo con la prueba de consecuencia y créalo primero.
2. **Ejecuta.** Corre el comando de verificación que el nivel actual exige y
   pega su salida real en el informe.
3. **No afirmes sin correr.** «Verificado», «funciona» y «listo» solo se
   escriben con la salida del comando delante. El handoff de otro agente no es
   evidencia: se comprueba.
4. **No falles en silencio.** Lo que no se pudo verificar se dice con nombre
   propio, en la respuesta, no en un log.
5. **No subas de nivel por tu cuenta.** Cerrar una brecha cambia el contrato del
   sistema y lo aprueba Isaac.
6. **Registra.** `nivel_actual` se actualiza solo cuando la puerta nueva ya
   corrió en verde una vez.

### Prohibiciones, aprendidas de esta máquina

- **`.bak` no es control de versiones.** Un `archivo.py.bak-antes-de-x` es la
  señal de que falta `git init`.
- **Un log que nadie lee no es una alerta.** Si el único rastro de un fallo está
  en un `.err.log`, el sistema falla en silencio por definición.
- **Un dato simulado no se presenta nunca como medido.** Si el valor es
  estimado, la interfaz lo dice.
- **Un Dataview vacío se investiga, no se asume correcto.** Casi siempre es un
  campo mal escrito ocultando datos que sí existen.
- **Una función sin prueba puede llevar semanas sin hacer nada** y nadie se
  entera. Ya pasó, con seis a la vez.
