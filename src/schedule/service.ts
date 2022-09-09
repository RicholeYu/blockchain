import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Spot } from '@binance/connector';
import sendEmail from '@dfyu/mailer';

const { BINANCE_KEY, BINANCE_SECURE } = process.env;
const client = new Spot(BINANCE_KEY, BINANCE_SECURE);

@Injectable()
export default class Service {
  constructor() {
    this.getWindowTicker();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async getWindowTicker() {
    const response = await client.rollingWindowTicker(
      '',
      ['BTCUSDT', 'ETHUSDT'],
      {
        windowSize: '1h',
      },
    );
    const ETH = response.data.find((item) => item.symbol === 'ETHUSDT');
    const BTC = response.data.find((item) => item.symbol === 'BTCUSDT');

    const pricePercent = (item) =>
      item.priceChangePercent.startsWith('-')
        ? `⬇️${+(+item.priceChangePercent.slice(1)).toFixed(2)}%️`
        : `⬆️${+(+item.priceChangePercent).toFixed(2)}%`;

    sendEmail({
      to: 'richoleyu@126.com',
      subject: '一小时币圈快报',
      html: [
        `<p>ETH: ${~~ETH.lastPrice}, ${pricePercent(ETH)}</p>`,
        `<p>BTC: ${~~BTC.lastPrice}, ${pricePercent(BTC)}</p>`,
      ].join(''),
    });
  }
}
