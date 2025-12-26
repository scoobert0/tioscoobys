module.exports = (pixController) => {
    return async function pixRoutes(fastify, options) {

        // These routes probably shouldn't be protected by API Key auth
        // if they are part of the payment flow that grants a key.
        // If they need protection, a different mechanism (like session) might be better.

        fastify.get('/pix/receber/:userId/:amount', {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        userId: { type: 'number' }, // This is the merchant/system user ID
                        amount: { type: 'number' }
                    },
                    required: ['userId', 'amount']
                }
            }
        }, pixController.generatePix);

        fastify.get('/pix/consultar/:userId/:clientIdentifier', {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        userId: { type: 'number' },
                        clientIdentifier: { type: 'string', minLength: 10 }
                    },
                    required: ['userId', 'clientIdentifier']
                }
            }
        }, pixController.consultPix);
    }
}