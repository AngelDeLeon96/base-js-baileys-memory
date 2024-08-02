import i18n from 'i18n'
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(__dirname)
i18n.configure({
    locales: ['es'],
    defaultLocale: 'es',
    register: global,
    directory: path.join(__dirname, 'locales'),
    autoReload: true, // Recargar automáticamente cuando cambian los archivos
    syncFiles: true, // Sincroniza los archivos al modificarse
    objectNotation: true // Permite notación de objetos para mensajes anidados
});


function showMSG(clave) {
    return String(i18n.__(clave));
}
export { i18n, showMSG }