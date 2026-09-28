# Bot de Discord de Inmortal Studios

Este proyecto deja la comunicación bot/API lista sin exponer el token del bot al navegador.

## Variables del bot

Configura en el proceso del bot:

```text
DISCORD_BOT_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DISCORD_API_KEY
INMORTAL_API_URL=https://<api-render>/api
```

El token del bot solo se usa dentro del proceso de Discord. `DISCORD_API_KEY` debe coincidir con la variable privada del API.

## Flujo `/verificar cuenta`

1. El usuario genera un código en la web.
2. Ejecuta `/verificar cuenta` en el servidor de Inmortal Studios.
3. El bot solicita el código.
4. El bot hace `POST ${INMORTAL_API_URL}/discord/verify`.
5. Si la respuesta es `verified: true`, el bot confirma el rol o mensaje.

## Contrato mínimo

```ts
const response = await fetch(`${process.env.INMORTAL_API_URL}/discord/verify`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.DISCORD_API_KEY!,
  },
  body: JSON.stringify({
    discordUserId: interaction.user.id,
    code: submittedCode,
  }),
});

const result = await response.json() as {
  verified: boolean;
  message: string;
  username: string | null;
};
```

El endpoint rechaza códigos inexistentes, vencidos o ya usados. Nunca envíes `DISCORD_BOT_TOKEN` en esta petición.