
import { addKeyword, EVENTS } from '@builderbot/bot';
import { sendMessageChatwood } from '../services/chatwood.js';
import { reactivarBot, reset, start, startBot, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import Queue from 'queue-promise';
const queue = new Queue({
    concurrent: 1,
    interval: 500
});

//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION)
    .addAnswer([showMSG('gracias'), showMSG('reiniciar_bot')], async (_, { endFlow, }) => {
        return endFlow('Trones');
    })


//hablar con un agente
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('desea_comunicarse'), 'Escriba:', '1️ para ✅sí ', '2️ para ⭕️no'], { capture: true }, async (ctx, { state, gotoFlow, globalState }) => {
        reset(ctx, gotoFlow);
        sendMessageChatwood([`¿Desea comunicarse con un agente?`, showMSG('opciones')], 'incoming', globalState.get('conversation_id'));
        await state.update({ check: ctx.body });
    })
    .addAction(async (ctx, { globalState, state, gotoFlow, endFlow, fallBack }) => {
        stop(ctx)
        const MSF = showMSG('opciones');
        sendMessageChatwood(state.get('check'), 'outgoing', globalState.get('conversation_id'));
        switch (state.get('check')) {
            case '1':
                //stop(ctx) debe detener aqui o no en la documentacion dice que no
                return gotoFlow(freeFlow);
            case '2':
                //stop(ctx)
                queue.enqueue(async () => {
                    sendMessageChatwood(showMSG('finished'), 'incoming', globalState.get('conversation_id'));
                });
                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                return fallBack(MSF);
        }
    })


//flujo libre
const freeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow, endFlow, blacklist }) => startBot(ctx, gotoFlow, endFlow, blacklist))
    .addAnswer(showMSG('connected'), async (ctx, { globalState, blacklist }) => {
        sendMessageChatwood(showMSG('connected'), 'incoming', globalState.get('conversation_id'))
        let number = ctx.from.replace("+", "")
        let check = blacklist.checkIf(number)
        //console.log(number, check)
        if (!check) {
            console.log(`bot desactivado para: ${number}`)
            blacklist.add(number)
            sendMessageChatwood(showMSG('bot_deactivated'), 'incoming', globalState.get('conversation_id'))
            return
        }
        //console.log(number, check)
    })

//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION)
    .addAnswer("Intenta nuevamente...",)

//flow salir
const flowMsgFinal = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state, globalState, gotoFlow }) => {
        stop(ctx)
        const MSG = `${showMSG('gracias')}\n${showMSG('agente_comunicara')} ${ctx.from}.`;
        await flowDynamic(MSG);
        await sendMessageChatwood(MSG, 'incoming', globalState.get('conversation_id'));
        return gotoFlow(flowTalkAgent)
    })

//docs
const mediaFlow = addKeyword(EVENTS.MEDIA)
    .addAnswer(`${showMSG('gracias')} ${showMSG('no_permitida')} ${showMSG('reiniciar_bot')}`, async (ctx, { endFlow }) => {
        return endFlow()
    })

//documents
const documentFlow = addKeyword(EVENTS.DOCUMENT)
    .addAnswer("Wow! I'm sorry I can't read this document right now", async (ctx, { provider }) => {
        const localPath = await provider.saveFile(ctx, { path: '...' })
        console.log('docimento capturado...')
    })

//voice notes
const voiceNoteFlow = addKeyword(EVENTS.VOICE_NOTE)
    .addAnswer(`${showMSG('gracias')} ${showMSG('no_permitida_voz')} ${showMSG('solicitud_agente')} ${showMSG('reiniciar_bot')}`, async (ctx, { endFlow }) => {
        return endFlow()
    })

export { flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow, mediaFlow, voiceNoteFlow };