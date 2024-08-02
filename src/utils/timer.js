import { addKeyword, EVENTS } from '@builderbot/bot'
import { showMSG } from '../i18n/i18n.js';
// Objeto para almacenar los temporizadores para cada usuario
const timers = {};
const remainingTimes = {};
const TIMER = process.env.TIMER ?? 100000
const TIMER_BOT = process.env.TIMER_BOT ?? 100000
console.log(TIMER / 60000, TIMER_BOT / 60000);

//flujo final por inactividad
const flujoFinal = addKeyword(EVENTS.ACTION)
    .addAnswer([showMSG('gracias'), showMSG('inactividad'), showMSG('reiniciar_bot')], async (_, { endFlow }) => {
        return endFlow();
    })


//reactiva el bot despues de X tiempo
// Iniciar o reiniciar el temporizador de inactividad para un usuario
const startBot = (ctx, gotoFlow, endFlow, blacklist, ms = TIMER_BOT) => {
    // Borra cualquier temporizador existente para el usuario
    if (timers[ctx.from]) {
        clearTimeout(timers[ctx.from]);
    }
    // Inicia un nuevo temporizador de inactividad
    timers[ctx.from] = setTimeout(() => {
        let number = ctx.from.replace("+", "")
        console.log(`User timeout startbot flow: ${ctx.from}`);
        if (blacklist.checkIf(number)) {
            blacklist.remove(number)
        }
        return endFlow(showMSG('bot_reactivated'));
    }, ms);

    // Almacena el tiempo restante
    remainingTimes[ctx.from] = ms;
}

//reactiva el bot para el usuario, se acabo el tiempo
const reactivarBot = (ctx, gotoFlow, endFlow, blacklist, ms = TIMER_BOT) => {
    timers[ctx.from] = setTimeout(() => {
        let number = ctx.from.replace("+", "")
        console.log(`User timeout: ${number}`);
        if (blacklist.checkIf(number)) {
            blacklist.remove(number)
        }
        return endFlow(showMSG('bot_reactivated'));
    }, ms);
}

// Reactivar el temporizador de inactividad para un usuario
const resumeBot = (ctx, gotoFlow) => {
    if (remainingTimes[ctx.from]) {
        timers[ctx.from] = setTimeout(() => {
            console.log(`User timeout: ${ctx.from}`);
            gotoFlow(flujoFinal);
        }, remainingTimes[ctx.from]);
        console.log(`User resumed: ${ctx.from}, remaining time: ${remainingTimes[ctx.from]}`);
    }
}

// Pausar el temporizador de inactividad para un usuario
const pauseBot = (ctx) => {
    //console.log('bot pausado: ', ctx);
    if (timers[ctx.from]) {
        // Calcula el tiempo restante
        const elapsedTime = TIMER_BOT - (remainingTimes[ctx.from] - Date.now());
        remainingTimes[ctx.from] = elapsedTime;

        // Borra el temporizador actual
        clearTimeout(timers[ctx.from]);
        timers[ctx.from] = null;

        console.log(`User paused: ${ctx.from}, remaining time: ${elapsedTime}`);
        return elapsedTime
    }
}

// Función para iniciar el temporizador de inactividad para un usuario
const start = (ctx, gotoFlow, ms = TIMER) => {
    timers[ctx.from] = setTimeout(() => {
        console.log(`User timeout: ${ctx.from}`);
        return gotoFlow(flujoFinal);
    }, ms);
}

// Función para reiniciar el temporizador de inactividad para un usuario
const reset = (ctx, gotoFlow, ms = TIMER) => {
    stop(ctx);
    if (timers[ctx.from]) {
        //console.log(`reset countdown for the user: ${ctx.from}`);
        clearTimeout(timers[ctx.from]);
    }
    start(ctx, gotoFlow, ms);
}

// Función para detener el temporizador de inactividad para un usuario
const stop = (ctx) => {
    if (timers[ctx.from]) {
        //console.log(`stopped countdown for the user: ${ctx.from}`);
        clearTimeout(timers[ctx.from]);
    }
}
//
const stopBot = (ctx) => {
    if (timers[ctx.from]) {
        console.log(`stopped countdown for the user: ${ctx.from}`);
        clearTimeout(timers[ctx.from]);
    }
}

export {
    start,
    reset,
    stop,
    flujoFinal,
    stopBot,
    reactivarBot,
    startBot,
    resumeBot,
    pauseBot
}
