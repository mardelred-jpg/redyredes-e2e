# RedyRedes E2E — Instrucciones para agentes

Este repositorio centraliza **toda** la validación end-to-end de la plataforma.
Core, Dashboard y Onboarding no contienen tests E2E: viven aquí y solo aquí.
Lee README.md antes de tocar nada.

## Reglas obligatorias

1. **La producción no se compromete.** Estas pruebas corren contra entornos
   reales. Nada de datos que ensucien, nada de acciones que cobren, nada que
   deje una organización o un usuario huérfano. Si una prueba necesita crear
   algo, tiene que poder limpiarlo.

2. **Una prueba que falla es una señal, no un estorbo.** No se relaja un
   selector, ni se sube un timeout, ni se marca `skip` para que el CI pase en
   verde. Si falla, se averigua por qué; si el fallo es real, se arregla en el
   repo que lo causa.

3. **Nada de esperas por tiempo.** Se espera por una condición observable —un
   elemento, una respuesta, un estado—, nunca por un número de milisegundos. Los
   `waitForTimeout` fijos son la causa habitual de las pruebas intermitentes.

4. **Cada prueba se sostiene sola.** No debe depender del orden de ejecución ni
   del estado que dejó otra. Si dos pruebas comparten preparación, va en
   `e2e/helpers/`, no en un acoplamiento implícito.

5. **El nombre dice qué se valida.** Los ficheros siguen la nomenclatura `PAT-`
   existente y el `describe` enuncia el recorrido de usuario, no el detalle
   técnico.

## Cómo trabajar

Pautas para reducir los errores habituales de un LLM escribiendo código. Las
reglas obligatorias de arriba mandan: ninguna de estas pautas puede usarse como
excusa para saltarse una. Sesgan hacia la prudencia antes que hacia la
velocidad; para tareas triviales, usa el criterio.

### 1. Pensar antes de escribir código

**No asumas. No escondas la duda. Enseña los compromisos.**

Antes de implementar:

- Enuncia los supuestos de forma explícita. Si hay incertidumbre, pregunta.
- Si caben varias interpretaciones, preséntalas; no elijas en silencio.
- Si existe un enfoque más simple, dilo. Discrepa cuando esté justificado.
- Si algo no está claro, para. Nombra qué te confunde. Pregunta.

### 2. Simplicidad

**El mínimo código que resuelve el problema. Nada especulativo.**

- Ninguna funcionalidad más allá de lo pedido.
- Ninguna "flexibilidad" ni "configurabilidad" que nadie haya pedido.
- Si escribes 200 líneas y podrían ser 50, reescríbelas.

La pregunta de control: "¿un ingeniero senior diría que esto está
sobrecomplicado?".

**El límite de esta sección.** Simplificar no es recortar cobertura. Una prueba
más corta que deja de comprobar lo que importa no es más simple: está rota. Y un
helper compartido que oculta qué se está validando tampoco ayuda — en pruebas,
la repetición explícita suele valer más que la abstracción.

### 3. Cambios quirúrgicos

**Toca solo lo imprescindible. Limpia solo lo que tú ensucies.**

Al editar código existente:

- No "mejores" el código, los comentarios ni el formato de alrededor.
- No refactorices lo que no está roto.
- Respeta el estilo existente, aunque tú lo harías de otra forma.
- Si detectas código muerto ajeno, menciónalo; no lo borres.

Cuando tus cambios dejen huérfanos:

- Elimina los imports, variables y funciones que hayan quedado sin uso **por tu
  cambio**.
- No elimines código muerto preexistente salvo que se pida.

La prueba: cada línea modificada debe poder trazarse a lo que pidió el usuario.

### 4. Ejecución verificable

**Define el criterio de éxito. Itera hasta comprobarlo.**

Aquí la prueba es el entregable, así que el criterio es lo que la prueba
demuestra:

- "Valida el alta" → "¿qué se ve en pantalla cuando el alta ha terminado bien?".
- "Cubre el cobro" → "¿qué estado deja el cobro y cómo se observa desde fuera?".
- Antes de dar algo por hecho, ejecuta la prueba y comprueba que **falla** si
  rompes a propósito lo que dice validar. Una prueba que pasa siempre no prueba
  nada.

Para tareas de varios pasos, enuncia un plan breve:

```
1. [Paso] → verificar: [comprobación]
2. [Paso] → verificar: [comprobación]
3. [Paso] → verificar: [comprobación]
```

---

**Estas pautas funcionan si:** los diffs traen menos cambios innecesarios, hay
menos reescrituras por sobrecomplicación, y las preguntas aclaratorias llegan
antes de implementar en vez de después del error.

<sub>Secciones 1, 3 y 4 adaptadas de
<a href="https://github.com/multica-ai/andrej-karpathy-skills">multica-ai/andrej-karpathy-skills</a>,
derivadas a su vez de observaciones públicas de Andrej Karpathy sobre los fallos
habituales de los LLM al programar.</sub>
