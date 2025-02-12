import express from 'express';
import { catch_error, findMyData } from '../utils/utils.js';
import { timers } from '../utils/timer.js';
import logger from '../utils/logger.js';
import { break_flow } from '../utils/utils.js';
import EnvLoader from '../utils/config.ts';

const env = EnvLoader.load();
const router = express.Router();
const TIMER_BOT = env.TIMER_BOT ?? 600000

// Enviar mensaje a usuario de WhatsApp
const chatWoodHook = async (req, res) => {
    try {
        const providerWS = req.providerWS;
        const bot = req.bot;
        const body = req.body;
        //const mapperAttributes = body?.conversation?.meta?.assignee;
        const mapperAttributes = findMyData(body, 'assignee');
        const attachments = body?.attachments;
        const phone = body.conversation?.meta?.sender?.phone_number.replace('+', '');
        const content = body.content;
        const status = body.status;
        const event = body.event;
        let break_word = break_flow(content);
        let partial_status = (status === "resolved" && event === "conversation_updated")

        if (break_word || partial_status) {
            let phone_check = bot.dynamicBlacklist.checkIf(phone)
            if (phone_check) {
                bot.dynamicBlacklist.remove(phone);
                logger.info('bot reactivado para el usuario:', { phone: phone })
                await providerWS.sendMessage(`${phone}`, '⭕️Comunicacion cerrada por el agente...', {});
                res.send('ok');
            }
            return;
        }

        /*La parte que se encarga de enviar un mensaje al whatsapp del cliente*/
        const checkIfMessage = body?.private == false && body?.event == "message_created" && body?.message_type === "outgoing" && body?.conversation?.channel.includes("Channel::Api")

        if (checkIfMessage && mapperAttributes !== null) {
            const content = body?.content ?? '';
            const file = attachments?.length ? attachments[0] : null;
            if (body?.event === 'message_created' && Object.hasOwn(mapperAttributes, 'id')) {
                const idAssigned = mapperAttributes.id ?? true;
                //const idAssigned = true;
                if (idAssigned) {
                    if (!bot.dynamicBlacklist.checkIf(phone) && !timers[phone]) {
                        bot.dynamicBlacklist.add(phone);
                        timers[phone] = setTimeout(() => {
                            if (bot.dynamicBlacklist.checkIf(phone)) {
                                bot.dynamicBlacklist.remove(phone)
                            }
                            //await providerWS.sendMessage(`${phone}`, '', {});
                            logger.info('bot reactivado despues de 30min para el usuario:', { phone: phone })
                        }, TIMER_BOT);
                    }
                } else {
                    logger.warn('Agente no asignado...');
                }
            }
            else {
                logger.warn('Agente no asignado...');

            }
            //envia los docs al whatsapp
            if (file) {
                console.log(file.data_url)
                //const fileURL = file.data_url.replace('http://127.0.0.1:3000/', process.env.BOT_URL)

                const fileURL = file.data_url
                await providerWS.sendMedia(`${phone}@c.us`, fileURL, content)
                //res.send('ok')
                return
            }
            /*esto envia un mensaje de texto al whatsapp de usuario*/
            await providerWS.sendMessage(`${phone}`, body.content, {});
            //res.send('ok');
            //console.log('=>OK')
            logger.info('mensaje enviado a', { phone: phone })
            return;
        }

        //res.send(body)
        res.send('ok')
    }
    catch (err) {
        catch_error(err)
        logger.error(`Error in chatWoodHook: ${err.message}`, { stack: err.stack, error: err.message });
    }

};

router.post('/chatwood-hook', chatWoodHook);

export default router;
