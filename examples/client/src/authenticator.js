import configuration from './configuration';

const login = async (email, password) => {
    const response = await fetch(`http://${configuration.api.host}:${configuration.api.port}/login`, {
        method: 'POST',
        headers: Object.assign({'Content-Type': 'application/json'}, configuration.api.extraHeaders),
        body: JSON.stringify({email, password}),
    });

    if (response.status === 401) { // unauthorized
        throw new Error('Invalid email or password.');
    }

    return await response.json();
};

export {
    login,
};
