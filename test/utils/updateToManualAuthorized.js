const {
    MESSAGE_ENTITY, MESSAGE_TYPE, ORDER_CREATOR, ORDER_TYPE, ORDER_OWNER,
    ORDER_DIRECTION, ORDER_STATUS, ORDER_EXIT_OUTCOME, ORDER_MARGIN_ENABLED
} = require("@superalgos/mqservice")

const axios = require('axios')

exports.updateToManualAuthorized = async function (processDatetime) {
    let signals = await getSignalsByCloneId(ORDER_STATUS.Signaled)
    for (let signal of signals) {
        let simulatorExecutorMessage = {}
        simulatorExecutorMessage.id = signal.orderData.id
        simulatorExecutorMessage.from = MESSAGE_ENTITY.SimulationExecutor
        simulatorExecutorMessage.to = MESSAGE_ENTITY.TradingCokpit
        simulatorExecutorMessage.messageType = MESSAGE_TYPE.Order
        simulatorExecutorMessage.dateTime = processDatetime

        simulatorExecutorMessage.order = signal.orderData
        simulatorExecutorMessage.order.status = ORDER_STATUS.ManualAuthorized

        await updateSignal(signal.id, simulatorExecutorMessage)
    }
}

async function updateSignal(signalId, message) {
    try {
        const cockPit = await axios({
            url: process.env.GATEWAY_ENDPOINT,
            method: 'post',
            data: {
                query: `
              mutation ($signalId: ID!, $message:cockpit_JSON!){
                cockpit_UpdateSignal(
                  id: $signalId
                  message: $message
                ) {
                  id
                  cloneId
                  orderStatus
                }
              }
              `,
                variables: {
                    signalId: signalId,
                    message: message
                },
            },
            headers: {
                authorization: 'Bearer ' + global.ACCESS_TOKEN
            }
        })

        console.log('updateSignal ok.')
        return cockPit.data.data.cockpit_UpdateSignal
    } catch (error) {
        console.log('updateSignal error: ' + error.response.data.errors[0])
        throw error
    }
}

async function getSignalsByCloneId(orderStatus) {
    try {
      const cockPit = await axios({
        url: process.env.GATEWAY_ENDPOINT,
        method: 'post',
        data: {
          query: `
            query($cloneId: String!, $orderStatus: String){
              cockpit_SignalsByCloneId(cloneId: $cloneId, orderStatus:$orderStatus){
                id
                cloneId
                orderId
                orderCreator
                orderStatus
                orderData
              }
            }
            `,
          variables: {
            cloneId: process.env.CLONE_ID,
            orderStatus: orderStatus
          },
        },
        headers: {
          authorization: 'Bearer ' + global.ACCESS_TOKEN
        }
      })

      console.log("Retrieved signals in status: " + orderStatus)
      return cockPit.data.data.cockpit_SignalsByCloneId

    } catch (error) {
        console.log('getSignalsByCloneId error: ' + error.response.data.errors[0])
      throw error
    }
  }
