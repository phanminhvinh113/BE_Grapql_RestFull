import amqplib from 'amqplib'
require('dotenv').config()
//
//const ampq_url_docker: string = process.env?.AMQP_URL_DOCKER || ''
const ampq_url_cloud: string = process.env?.AMQP_URL_CLOUD?.toString() || ''
//
export const sendQueue = async ({ msg }: { msg: string }) => {
   try {
      //1
      const connect = await amqplib.connect(ampq_url_cloud)
      //2
      const chanel = await connect.createChannel()
      //3. create name queue
      const nameQueue: string = 'q_1'
      //
      await chanel.assertQueue(nameQueue, {
         durable: true, // true is when restart doesn't delete data.
      })
      //
      await chanel.sendToQueue(nameQueue, Buffer.from(msg), {
         expiration: '10000',
         persistent: true,
      })
      //
   } catch (error) {
      console.log(error)
   }
}
//
void sendQueue({ msg: 'h_123@' })
