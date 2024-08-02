
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import fs from 'fs/promises'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import ServerHttp from './http/server.js';
import { sendMessageChatwood, recover, createConversationChatwood } from './services/chatwood.js'
import { flujoFinal, reset, start, stop, resumeBot, pauseBot } from './utils/timer.js'
import { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow, voiceNoteFlow } from './flows/agents.js'
const PORT = process.env.PORT_WB ?? 1000
import Queue from 'queue-promise';
import mimeType from 'mime-types'
import { catch_error, verificarOCrearCarpeta, esHorarioLaboral } from './utils/utils.js';
import { showMSG, i18n } from './i18n/i18n.js';
import debounce from './utils/debounce.js';

const queue = new Queue({
    concurrent: 1,
    interval: 500
})
i18n.init()

//registramos un MSG en una conversacion
const registerMsgConversation = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(showMSG('solicitar_nombre'), { capture: true }, async (ctx, { state, gotoFlow, globalState, fallBack }) => {
        reset(ctx, gotoFlow);
        //let debounceSendMsgChat = debounce(sendMessageChatwood);
        //debounceSendMsgChat(showMSG('solicitar_nombre'), 'incoming', globalState.get('conversation_id'));
        await sendMessageChatwood(showMSG('solicitar_nombre'), 'incoming', globalState.get('conversation_id'));
        await state.update({ name: ctx.body });
        const regex = new RegExp('_event_[a-zA-Z0-9-_]+');
        const checkedText = regex.test(ctx.body);
        if (checkedText) {
            //await flowDynamic(showMSG('solicitar_nombre'));
            return fallBack();
        }
        else {
            queue.enqueue(async () => {
                sendMessageChatwood(state.get('name'), 'outgoing', globalState.get('conversation_id'));
            });
        }
    })
    .addAnswer(showMSG('solicitar_consulta'), { capture: true, delay: 500 }, async (ctx, { state, gotoFlow, globalState, fallBack }) => {
        reset(ctx, gotoFlow);
        //let debounceSendMsgChat2 = debounce(sendMessageChatwood);
        //let debounceGoto = debounce(gotoFlow)
        await sendMessageChatwood(showMSG('solicitar_consulta'), 'incoming', globalState.get('conversation_id')); // Registrar
        await state.update({ consulta: ctx.body });
        const regex = new RegExp('_event_[a-zA-Z0-9-_]+');
        const checkedText2 = regex.test(ctx.body);
        if (checkedText2) {
            //await flowDynamic(showMSG('solicitar_consulta'));
            return fallBack();
        }
        else {
            queue.enqueue(async () => {
                sendMessageChatwood(state.get('consulta'), 'outgoing', globalState.get('conversation_id'));
            });
            console.log(`==>`);
            return gotoFlow(flowMsgFinal);
        }
    });

//creamos la conversacion(ya debe ser contacto), si el user no tiene ninguna conversacion abierta.
const createConversation = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { gotoFlow, globalState }) => {
        try {
            createConversationChatwood('', 'outgoing', globalState.get('contact_id'))
            return gotoFlow(userRegistered)
        }
        catch (err) {
            console.error(err)
        }
    });

//flujo que recupera los datos del usuario registrado
const userRegistered = addKeyword(EVENTS.ACTION)
    .addAction({ delay: 500 }, async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        try {
            //console.log(`flow user registered`)
            const MSG0 = showMSG('solicitar_datos');
            await flowDynamic(MSG0);
            sendMessageChatwood(MSG0, 'incoming', globalState.get('conversation_id'));
            //const conversation_id = globalState.get('conversation_id')
            //console.log('registering msg...')
            return gotoFlow(registerMsgConversation);
            // si existe una conversacion abierta, se registran los mensajes
        }
        catch (err) {
            catch_error(err)
        }
    });

//flujo si el usuario no esta registrado como contacto
const userNotRegistered = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, endFlow }) => {
        try {
            //console.log('Unregistered')
            const numero = ctx.from
            var FORMULARIO = process.env.FORM_URL
            var MSG = [
                `${showMSG('llenar_form')}: ${FORMULARIO}.`,
                `${showMSG('agente_comunicara')}: ${numero}.`
            ]
            await flowDynamic(MSG)
            return endFlow()
        }
        catch (err) {
            catch_error(err)
            return endFlow()
        }
    });

//flow principal
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { endFlow, blacklist }) => {
        console.log('<======>')
        const now = new Date();
        if (!esHorarioLaboral(now)) {
            return endFlow(showMSG('fuera_laboral'))
        } else {
            if (blacklist.checkIf(ctx.from.replace('+', ''))) {
                console.log('user blocked')
                return endFlow()
            }
        }
    })
    .addAnswer(showMSG('bienvenida'), { capture: false }, async (ctx, { globalState, gotoFlow, endFlow }) => {
        try {
            const MNSF = showMSG('bienvenida');
            const user_data = await recover(ctx.from);
            //set las variables con los datos del usuario como su: id y id de conversation
            await globalState.update({ conversation_id: user_data.conversation_id });
            await globalState.update({ contact_id: user_data.user_id });
            //console.log('data user', globalState.get('contact_id'), typeof (globalState.get('conversation_id')));
            /*  puede ser contact id= 1, conversation id= 1 .
                contact id= 0, conversation id= 0
                contact id= 1, conversation id= 0
            */
            if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') > 0) {
                console.log('user found...', globalState.get('contact_id'));
                sendMessageChatwood(MNSF, 'incoming', globalState.get('conversation_id'));
                return gotoFlow(userRegistered);
            } else if (globalState.get('contact_id') == 0 && globalState.get('conversation_id') == 0) {
                console.log('user not found...');
                return gotoFlow(userNotRegistered);
            }
            else if (globalState.get('contact_id') > 0 && globalState.get('conversation_id') == 0) {
                console.log(`user found: ${globalState.get('contact_id')} => creating conversation: ${globalState.get('conversation_id')}`);
                await createConversationChatwood('', 'outgoing', globalState.get('contact_id'));
                const user_data2 = await recover(ctx.from);
                await globalState.update({ conversation_id: user_data2.conversation_id });
                await globalState.update({ contact_id: user_data2.user_id });
                console.log(globalState.get('contact_id'), globalState.get('conversation_id'));

                sendMessageChatwood(MNSF, 'incoming', user_data.contact_id);
                return gotoFlow(userRegistered);
            } else {
                return endFlow(showMSG('error_generico'));
            }
        }
        catch (err) {
            catch_error(err);
        }
    })



//flujo principal
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, userNotRegistered, userRegistered, createConversation, registerMsgConversation, flowDefault, flujoFinal, flowTalkAgent, mediaFlow, documentFlow, freeFlow, flowGoodBye, flowMsgFinal, voiceNoteFlow]);
    const adapterProvider = createProvider(Provider);
    const adapterDB = new Database();

    const bot = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    },
        {
            queue: {
                timeout: 20000, //👌
                concurrencyLimit: 50 //👌
            }
        }
    );
    const server = new ServerHttp(adapterProvider, bot);
    server.start();
    bot.httpServer(+PORT);
    //bot desactivado
    adapterProvider.on('message', (payload) => {
        try {
            //verificamos si el usuario esta con el bot desactivado, es decir el modo libre esta activado
            console.log(`payload: `, JSON.stringify(payload))

            let debounceSendMSG = debounce(sendMessageChatwood, 1000);
            if (bot.dynamicBlacklist.checkIf(payload.from)) {
                //console.log(JSON.stringify(payload))
                queue.enqueue(async () => {
                    const attachment = [];
                    let caption, msg = "";
                    const mime = payload?.message?.imageMessage?.mimetype ?? payload?.message?.videoMessage?.mimetype ?? payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype ?? payload?.message?.audioMessage?.mimetype;
                    console.log('mensaje capturado con el provider: ');
                    if (payload?.body.includes('_event_') || mime) {
                        const extension = mimeType.extension(mime);
                        let mimeslice = mime.split("/")[0];
                        console.log(mimeslice)
                        if (mimeslice === 'image') {
                            caption = payload?.message?.imageMessage?.caption;
                        } else {
                            caption = payload?.message?.documentWithCaptionMessage?.message?.documentMessage?.caption;
                        }
                        const buffer = await downloadMediaMessage(payload, "buffer");
                        const fileName = `file-${Date.now()}.${extension}`;
                        verificarOCrearCarpeta(`${process.cwd()}/public/docs`);

                        const pathFile = `${process.cwd()}/public/docs/${fileName}`;
                        //msg = payload?.
                        await fs.writeFile(pathFile, buffer);
                        attachment.push(pathFile);
                        msg = caption;
                    }
                    else {
                        msg = payload?.body;
                    }
                    //console.log(msg)
                    const daata = await recover(payload.from);
                    const conversation_id = daata.conversation_id;
                    if (conversation_id != 0) {
                        //console.log('data to send: ', conversation_id, attachment, msg)
                        const msg2 = debounceSendMSG(msg, 'incoming', conversation_id, attachment);
                        pauseBot(payload)
                    }
                })
            }
        }
        catch (err) {
            catch_error(err);
            //console.error('ERROR', err)
        }
    });
}
main()
