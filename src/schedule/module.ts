import { Module } from '@nestjs/common';
import Service from './service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [],
  providers: [Service],
})
export default class AppScheduleModule {}
