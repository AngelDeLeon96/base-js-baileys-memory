import { addKeyword, EVENTS } from '@builderbot/bot';
import path from 'path'
import { sendMessageChatwood } from '../services/chatwood.js';
import { reset, start, stop } from '../utils/timer.js';
import { showMSG } from '../i18n/i18n.js';
import { freeFlow } from './agents.js';
import { saveMediaWB, extractMimeWb, checkInputMenu } from '../utils/utils.js';
import EnvLoader from '../utils/config.ts';
const env = EnvLoader.load();
const ALLOWED_DOCS = env.ALLOWED_DOCS;

const prima_menu = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer([showMSG('menu'), showMSG('solicitar_consulta'), showMSG('prima_opcion_1'), showMSG('prima_opcion_2'), showMSG('prima_opcion_3'), showMSG('prima_opcion_4'), showMSG('prima_opcion_5'), `6. ${showMSG('exit')}`], { capture: true }, async (ctx, { state, gotoFlow, fallBack }) => {
        reset(ctx, gotoFlow);
        await state.update({ 'prima_menu_opc': ctx.body });
        const inputChecked = checkInputMenu(state.get("prima_menu_opc"))
        //verificamos que los datos que envia el usuario numeros y no cualquier otra cosa
        if (!inputChecked) {
            return fallBack(`${showMSG('solicitar_consulta')}`);
        }
    })
    .addAction({ delay: 200 }, async (ctx, { state, gotoFlow, endFlow, fallBack, globalState }) => {
        sendMessageChatwood(`${showMSG('selected')} ${state.get('prima_menu_opc')}`, 'incoming', globalState.get('conversation_id'));
        stop(ctx);
        switch (parseInt(state.get('prima_menu_opc'))) {
            case 1:
                return gotoFlow(primera_vez);
            case 2:
                return gotoFlow(attach_forms);
            case 3:
                return gotoFlow(attach_forms_cedula);
            case 4:
                return gotoFlow(attach_forms_continuidad);
            case 5:
                return gotoFlow(freeFlow);
            case 6:
                return endFlow(`${showMSG('gracias')}\n${showMSG('reiniciar_bot')}`);
            default:
                reset(ctx, gotoFlow);
                return fallBack(showMSG('opcion_invalida'));
        }
    })

const primera_vez = addKeyword(EVENTS.ACTION)
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_1')}`)
    .addAnswer(`${showMSG('llenar_form')}`, { media: path.join(process.cwd(), 'public/files', 'fest.png') })
    .addAnswer(`${showMSG('subir_pdf')} `)
    .addAction({ delay: 200 }, async (_, { gotoFlow }) => {
        //return endFlow(`${showMSG('formulario_captado')}`)
        return gotoFlow(prima_menu)
    })

//flow para attach los docs de form,.
const attach_forms = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_2')}`)
    .addAnswer(`${showMSG('adjuntar_form')}\n${showMSG('exit_opt')}`, { capture: true }, async (ctx, { fallBack, globalState, gotoFlow }) => {
        reset(ctx, gotoFlow);
        let cancelar = ctx.body;
        if (cancelar.toLowerCase() === "cancelar" || cancelar.toLowerCase() === "salir") {
            stop(ctx)
            sendMessageChatwood("El usuario decidio salir.", 'incoming', globalState.get('conversation_id'));
            return gotoFlow(prima_menu);
        }
        let extractedMime = extractMimeWb(ctx)

        if (ALLOWED_DOCS.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx)
            sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`Solo se permiten los archivos en formato: ${ALLOWED_DOCS}. ${showMSG('try_again')}`);
        }
    })
    .addAction({ delay: 200 }, async (ctx, { gotoFlow, flowDynamic }) => {
        stop(ctx)
        await flowDynamic(showMSG('formulario_captado'))
        return gotoFlow(prima_menu)
    })

//flow para attach los docs de cedula.
const attach_forms_cedula = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_3')}`)
    .addAnswer(`${showMSG('adjuntar_cedula')}\n${showMSG('exit_opt')}`, { capture: true }, async (ctx, { fallBack, globalState, gotoFlow }) => {
        reset(ctx, gotoFlow);
        let cancelar = ctx.body;
        if (cancelar.toLowerCase() === "cancelar" || cancelar.toLowerCase() === "salir") {
            stop(ctx);
            return gotoFlow(prima_menu);
        }
        let extractedMime = extractMimeWb(ctx);

        if (ALLOWED_DOCS.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx)
            sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`${showMSG('no_permitida')} Solo se permiten los archivos en formato: ${ALLOWED_DOCS}. ${showMSG('try_again')}`);
        }
    })
    .addAction(async (ctx, { gotoFlow, flowDynamic }) => {
        stop(ctx);
        await flowDynamic(showMSG('cedula_captada'));
        return gotoFlow(prima_menu);
    })

const attach_forms_continuidad = addKeyword('attach2')
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow))
    .addAnswer(`${showMSG('selected')} ${showMSG('prima_opcion_4')}`)
    .addAnswer(`${showMSG('adjuntar_continuidad')}\n${showMSG('exit_opt')}`, { capture: true }, async (ctx, { globalState, fallBack, gotoFlow }) => {
        reset(ctx, gotoFlow);
        let cancelar = ctx.body;
        if (cancelar.toLowerCase() === "cancelar" || cancelar.toLowerCase() === "salir") {
            stop(ctx);
            return gotoFlow(prima_menu);
        }
        let extractedMime = extractMimeWb(ctx);
        if (ALLOWED_DOCS.includes(extractedMime)) {
            let [msg, attachment] = await saveMediaWB(ctx);
            await sendMessageChatwood(msg, 'incoming', globalState.get('conversation_id'), attachment);
        }
        else {
            return fallBack(`${showMSG('no_permitida')} Solo se permiten los archivos en formato: ${ALLOWED_DOCS}. ${showMSG('try_again')}`);
        }
    })
    .addAction(async (ctx, { gotoFlow, flowDynamic }) => {
        stop(ctx);
        await flowDynamic(showMSG('formulario_captado'));
        return gotoFlow(prima_menu);
    })



export { primera_vez, prima_menu, attach_forms, attach_forms_cedula, attach_forms_continuidad };
