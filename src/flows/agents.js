
import { addKeyword, EVENTS } from '@builderbot/bot';
import { reset, start, startBot, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import logger from '../utils/logger.js';
import EnvLoader from '../utils/config.ts';

const env = EnvLoader.load();
const TIMER_BOT = env.TIMER_BOT;

//good bye
const flowGoodBye = addKeyword(EVENTS.ACTION)
    .addAnswer([showMSG('gracias'), showMSG('reiniciar_bot')], async (_, { endFlow, }) => {
        return endFlow();
    })
//
const flowAddTime = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('aumentar_tiempo'), showMSG('opciones')], { capture: true }, async (ctx, { state, gotoFlow }) => {
        reset(ctx, gotoFlow);
        //sendMessageChatwood([showMSG('aumentar_tiempo'), showMSG('opciones')], 'outgoing', globalState.get('conversation_id'));
        await state.update({ response: ctx.body });
        //console.log(state.get('response'))
    })
    .addAction(async (ctx, { state, gotoFlow, endFlow, fallBack }) => {
        stop(ctx);
        //sendMessageChatwood(state.get('response'), 'incoming', globalState.get('conversation_id'));
        //switch
        switch (state.get('response')) {
            case '1':
                //console.log('si')
                return gotoFlow(freeFlow);
            case '2':
                //console.log('no')
                return endFlow(showMSG('bot_reactivated'));
            default:
                return fallBack();
        }
    })

//hablar con un agente
const flowTalkAgent = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('desea_comunicarse'), 'Escriba:', showMSG('opcion_1'), showMSG('opcion_2')], { capture: true }, async (ctx, { state, gotoFlow }) => {
        reset(ctx, gotoFlow);
        //sendMessageChatwood([showMSG("desea_comunicarse"), showMSG('opciones')], 'outgoing', globalState.get('conversation_id'));
        await state.update({ check: ctx.body });
    })
    .addAction(async (ctx, { state, gotoFlow, endFlow, fallBack }) => {
        stop(ctx)
        const MSF = showMSG('opciones');
        //sendMessageChatwood(`${showMSG('usuario_respondio')} ${state.get('check')}`, 'incoming', globalState.get('conversation_id'));
        switch (state.get('check')) {
            case '1':
                //stop(ctx) debe detener aqui o no en la documentacion dice que no, vamos al flujo libre
                return gotoFlow(freeFlow);
            case '2':
                //stop(ctx)

                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                return fallBack(MSF);
        }
    })


//flujo libre
const freeFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow, endFlow, blacklist }) => startBot(ctx, gotoFlow, endFlow, blacklist))
    .addAnswer(`${showMSG('connected')} ${TIMER_BOT / 60000} minutos.`, async (ctx, { blacklist }) => {
        let number = ctx.from.replace("+", "")
        let check_num = blacklist.checkIf(number)
        //console.log(number, check)
        if (!check_num) {
            logger.info(`bot desactivado para: ${number} por ${(TIMER_BOT / 60000)}min.`)
            blacklist.add(number)
            return
        }
        //console.log(number, check)
    })

//flujo por si no se marca opcion
const flowDefault = addKeyword(EVENTS.ACTION)
    .addAnswer("Intenta nuevamente...",)

//flow salir
const flowMsgFinal = addKeyword(EVENTS.ACTION)
    .addAnswer([showMSG('gracias'), showMSG('aumentar_tiempo'), showMSG('reiniciar_bot')],)
    .addAction(async (ctx, { endFlow }) => {
        stop(ctx)
        //sendMessageChatwood(MSG, 'outgoing', globalState.get('conversation_id'));
        return endFlow()
    })

//docs
const mediaFlow = addKeyword(EVENTS.MEDIA)
    .addAnswer(showMSG('gracias'))
    .addAction(async (_, { endFlow }) => {
        return endFlow(`${showMSG('reiniciar_bot')}`)
    })

//documents
const documentFlow2 = addKeyword(EVENTS.DOCUMENT)
    .addAnswer(showMSG('gracias'))
    .addAction(async (_, { endFlow }) => {
        return endFlow(`${showMSG('reiniciar_bot')}`)
    })

//voice notes
const voiceNoteFlow = addKeyword(EVENTS.VOICE_NOTE)
    .addAnswer(showMSG('gracias'))
    .addAction(async (_, { endFlow }) => {
        return endFlow()
    })

export { flowAddTime, flowTalkAgent, freeFlow, flowGoodBye, flowDefault, flowMsgFinal, documentFlow2, mediaFlow, voiceNoteFlow };