import { catch_error } from '../utils/utils.js';
import { readFile } from 'fs/promises';
import { releaseLock, acquireLock } from '../utils/in-memory-lock.js';
import logger from '../utils/logger.js';
import isUrlOnline from './isAlive.js';
import EnvLoader from '../utils/config.ts';
const env = EnvLoader.load();

const SERVER = env.CHATWOOT_URL || "http://localhost";
const ACCOUNT_ID = env.CHATWOOT_ACCOUNT_ID ?? 2;
const INBOX_ID = env.CHATWOOT_INBOX_ID ?? 5;
const API = env.CHATWOOT_API;


//console.log('server: ', SERVER, PORT);
// Map para trackear las creaciones en proceso
const pendingSearches = new Map();
const pendingRecovers = new Map()

const checkServer = async () => {
    const online = await isUrlOnline(SERVER);
    const status = online ? 'Online' : "Offline";
    if (!online) {
        logger.error(`Error a conectarse al servidor ${SERVER}`, { "Status": status })
    }

}
const headersApi = () => {
    const myHeaders = new Headers();
    myHeaders.append("api_access_token", API);
    myHeaders.append("Content-Type", "application/json");
    return myHeaders
}

checkServer();

const builderURL = (path) => {
    return `${SERVER}/api/v1/accounts/${ACCOUNT_ID}/${path}`
}


//create
const createConversationChatwood = async (contact_id = 0) => {
    try {
        const myHeaders = headersApi();
        const url = builderURL('conversations')
        const bodyRaw = JSON.stringify({
            inbox_id: INBOX_ID,
            contact_id: contact_id,
        });
        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: bodyRaw,
        };

        const dataRaw = await fetch(url, requestOptions);

        if (dataRaw.status >= 200 || dataRaw.status < 300) {
            const response = await dataRaw.json();
            return response.id;
        }
        else {
            return 0
        }

    } catch (err) {
        logger.error("Error al crear una conversacion", { err: err })
        //return null
    }
}

const sendMessageChatwood = async (msg = "", message_type = "incoming", conversation_id = 0, attachments = []) => {
    try {
        if (!conversation_id) {
            logger.error("ID de conversacion no válido. No se realizará la solicitud.", { id: conversation_id });
            return null; // O podrías devolver un objeto que indique que no se realizó la solicitud
        }
        const url = builderURL(`conversations/${conversation_id}/messages`);
        const myHeaders = new Headers();
        myHeaders.append("api_access_token", API);

        const form = new FormData();
        form.set("content", msg);
        form.set("message_type", message_type);
        form.set("private", "true");

        if (attachments.length) {
            const fileName = attachments[0].split('/').pop();
            try {
                const fileContent = await readFile(attachments[0]);
                const blob = new Blob([fileContent]);
                form.set("attachments[]", blob, fileName);
            } catch (readFileError) {
                logger.error('Error al leer el archivo adjunto:', readFileError);
                //throw readFileError;
            }
        }

        const dataRaw = await fetch(url, {
            method: "POST",
            headers: myHeaders,
            body: form
        });
        const response = await dataRaw.json();
        if (dataRaw.status >= 200 || dataRaw.status < 300) {

            return response;
        }


    } catch (err) {
        logger.error('Error en sendMessageChatwood:', { error: err });
        throw err; // Re-lanza el error para que el llamador pueda manejarlo
    }
};

const createContact = async (phone = "") => {
    try {
        const myHeaders = headersApi();
        const url = builderURL('contacts');
        const contact_data = {}

        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            name: `${phone}`,
            phone_number: `+${phone}`
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };

        const dataRaw = await fetch(url, requestOptions);
        const response = await dataRaw.json();

        if (dataRaw.status >= 200 && dataRaw.status < 300) {
            contact_data.id = response.payload.contact.id;
            contact_data.new = 1;
            logger.info(`Se creó el contacto: ${phone} con id: ${contact_data.id} new: ${contact_data.new}`);
            return contact_data
        } else {
            logger.error("Error al crear el contacto", { error: dataRaw })
        }

    }
    catch (err) {
        logger.error("Error al crear el contacto", { error: err })

    }
}

const updateContact = async (id = 0, nombre = "", cedula = "") => {
    try {
        const myHeaders = headersApi();
        const url = builderURL(`contacts/${id}`);

        const raw = JSON.stringify({
            inbox_id: INBOX_ID,
            name: nombre,
            custom_attributes: {
                cedula: cedula
            }
        });

        const requestOptions = {
            method: "PUT",
            headers: myHeaders,
            body: raw,
        };

        const dataRaw = await fetch(url, requestOptions);
        const response = await dataRaw.json();

        if (dataRaw.status >= 200 && dataRaw.status < 300) {
            logger.info(`Se actualizó el contacto: ${nombre} con id: ${id} cedula: ${cedula}`);
        }

        if (dataRaw.status > 400) {
            logger.error("Error al actualizar el contacto", { err: dataRaw.status })
        }

        return response.status
    }
    catch (err) {
        console.log(err)
        logger.error("Error al actualizar el contacto", { "error": err });
    }

}

const searchUser = async (user = "") => {
    // Si ya hay una búsqueda en proceso para este usuario, retornar esa promesa
    if (pendingSearches.has(user)) {
        return pendingSearches.get(user);
    }

    const searchPromise = (async () => {
        try {
            const url = builderURL(`contacts/search?q=${user}`);
            let data_user = {};
            const myHeaders = headersApi();
            const requestOptions = {
                method: "GET",
                headers: myHeaders,
            };
            const dataRaw = await fetch(url, requestOptions);
            const response = await dataRaw.json();

            if (dataRaw.status >= 200 && dataRaw.status < 300) {
                const { meta, payload } = response;

                // Si encontramos el usuario
                if (payload.length > 0) {
                    data_user.user_id = payload[0].id;  // Tomamos el primer resultado
                    data_user.new = 0;
                    data_user.nombre = payload[0].name;
                    data_user.cedula = payload[0].custom_attributes.cedula;
                }
                else {
                    const res_contact = await createContact(user);
                    data_user.user_id = res_contact.id;
                    data_user.new = res_contact.new;
                    data_user.nombre = user;
                    data_user.cedula = "0000000000";
                }

                data_user.count = meta.count;
                return data_user;

            } else {
                console.log("Error: ", response);

            }

        } catch (err) {
            logger.error("Se produjo un error al buscar", { "error": err })
        } finally {
            // Limpiar el Map de búsquedas pendientes
            pendingSearches.delete(user);
        }
    })();

    // Guardar la promesa en el Map
    pendingSearches.set(user, searchPromise);

    return searchPromise;
};

const recoverConversation = async (id = 0, user = "") => {

    if (pendingRecovers.has(id)) {
        console.log("conversacion recuperada", pendingRecovers, "id", id, user)
        return pendingRecovers.get(id)
    }

    const recoverPromise = (async () => {
        try {
            let conversation_id = 0
            const url = builderURL(`contacts/${id}/conversations`)
            const myHeaders = headersApi()
            const requestOptions = {
                method: "GET",
                headers: myHeaders,
            };
            const dataRaw = await fetch(url, requestOptions)
            const response = await dataRaw.json()
            console.log(response.payload.length)
            const payload = response.payload

            if (payload.length > 0) {
                if (payload[0].status === "open") {
                    conversation_id = payload[0].id
                }
            }
            else {
                conversation_id = 0
            }

            return parseInt(conversation_id)
        } catch (err) {
            logger.error("Error al recuperar la conversacion", { err: err })
        }
        finally {
            pendingRecovers.delete(id)
        }
    })()
    pendingRecovers.set(id, recoverPromise)

    return recoverPromise
};

const recover = async (user = {}) => {
    try {
        const data_user = await searchUser(user);

        if (data_user.user_id > 0) {
            const lockKey = `user_conversation_${data_user.user_id}`;
            try {
                await acquireLock(lockKey);
                const conversation_id = await recoverConversation(data_user.user_id, user)
                console.log("id: ", conversation_id)
                if (conversation_id == 0) {
                    const new_conv = await createConversationChatwood(data_user.user_id)
                    logger.info('Nueva conversación creada', { 'id': new_conv, 'user': user })
                    data_user.conversation_id = new_conv
                } else {
                    data_user.conversation_id = conversation_id
                }
            } finally {
                await releaseLock(lockKey);
            }
        } else {
            logger.warn('No se encontró el usuario:', { error: user })
            return null
        }
        return data_user

    } catch (err) {
        catch_error(err)
    }
};


export { sendMessageChatwood, createConversationChatwood, searchUser, recoverConversation, recover, updateContact };
