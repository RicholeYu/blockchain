import { Module } from '@nestjs/common';
import Service from './service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [],
  providers: [Service('BTC'), Service('ETH')],
})
export default class AppScheduleModule {}
