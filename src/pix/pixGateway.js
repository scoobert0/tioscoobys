const PIX_GATEWAY_BASE_URL = 'https://mmtbank.fr4ud.center/mmtbank/pix';
const USER_ID = 7351792062; // Hardcoded as per requirement

const pixGateway = {
  /**
   * Generates a new PIX transaction via the gateway.
   * @param {number} amount The amount for the PIX transaction.
   * @returns {Promise<object>} The JSON response from the gateway.
   */
  async generatePix(amount) {
    const url = `${PIX_GATEWAY_BASE_URL}/receber/${USER_ID}/${amount}`;
    console.log(`[PixGateway] Generating PIX: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[PixGateway] Error generating PIX. Status: ${response.status}, Body: ${errorBody}`);
        throw new Error(`Gateway error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[PixGateway] Network or fetch error in generatePix:', error);
      throw new Error('Failed to communicate with PIX gateway.');
    }
  },

  /**
   * Consults the status of an existing PIX transaction.
   * @param {string} clientIdentifier The unique identifier for the transaction.
   * @returns {Promise<object>} The JSON response from the gateway.
   */
  async consultPix(clientIdentifier) {
    const url = `${PIX_GATEWAY_BASE_URL}/consultar/${USER_ID}/${clientIdentifier}`;
    // console.log(`[PixGateway] Consulting PIX: ${url}`); // This can be noisy

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[PixGateway] Error consulting PIX. Status: ${response.status}, Body: ${errorBody}`);
        throw new Error(`Gateway error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[PixGateway] Network or fetch error in consultPix for clientIdentifier ${clientIdentifier}:`, error);
      throw new Error('Failed to communicate with PIX gateway.');
    }
  },
};

module.exports = pixGateway;
