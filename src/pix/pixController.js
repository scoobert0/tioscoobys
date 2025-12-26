module.exports = (pixService, responseFormatter) => {
    const pixController = {
        async generatePix(request, reply) {
            try {
                const { userId: merchantUserId, amount } = request.params;
                const loggedInUsername = request.session.user.username; // Get user from session

                const pixData = await pixService.handleGeneratePixRequest(loggedInUsername, parseInt(merchantUserId), parseFloat(amount));
                return reply.send(pixData);
            } catch (error) {
                console.error('[PixController] Error generating PIX:', error.message);
                const statusCode = error.statusCode || 500;
                return reply.status(statusCode).send(responseFormatter.formatError({ message: error.message, statusCode }));
            }
        },

        async consultPix(request, reply) {
            try {
                const { userId: merchantUserId, clientIdentifier } = request.params;
                if (!clientIdentifier) {
                     return reply.status(400).send(responseFormatter.formatError({ message: 'clientIdentifier is required.', statusCode: 400 }));
                }
                // The merchantUserId from the URL is available here if needed by the service
                const statusData = await pixService.handleConsultPixRequest(clientIdentifier);
                return reply.send(statusData);
            } catch (error) {
                console.error('[PixController] Error consulting PIX:', error.message);
                return reply.status(500).send(responseFormatter.formatError({ message: 'Failed to consult PIX status.', statusCode: 500 }));
            }
        }
    };
    return pixController;
}