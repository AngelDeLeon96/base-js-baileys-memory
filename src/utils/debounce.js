const TIMERD = process.env.DEBOUNCE_TIME ?? 10000

const debounce = (func, ms = TIMERD) => {
    let timeout = 0;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), ms);
    }
}

export default debounce;

