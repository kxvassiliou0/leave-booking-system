import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator'
import { RoleType } from '@enums'
import { Department } from './Department.entity.ts'
import { LeaveRequest } from './LeaveRequest.entity.ts'

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty()
  @IsString()
  firstName!: string

  @Column()
  @IsNotEmpty()
  @IsString()
  lastName!: string

  @Column({ unique: true })
  @IsEmail()
  email!: string

  @Column()
  @IsNotEmpty()
  @IsString()
  password!: string

  @Column({ type: 'simple-enum', enum: RoleType })
  @IsEnum(RoleType)
  role!: RoleType

  @Column({ default: 28 })
  @IsInt()
  @IsPositive()
  annualLeaveAllowance!: number

  @ManyToOne(() => Department, (department: Department) => department.users)
  department!: Department

  @Column()
  @IsInt()
  @IsPositive()
  departmentId!: number

  @ManyToOne(() => User, (user: User) => user.subordinates, { nullable: true })
  manager!: User | null

  @Column({ nullable: true })
  @IsOptional()
  @IsInt()
  managerId!: number | null

  @OneToMany(() => User, (user: User) => user.manager)
  subordinates!: User[]

  @OneToMany(() => LeaveRequest, (leaveRequest: LeaveRequest) => leaveRequest.user)
  leaveRequests!: LeaveRequest[]

  @OneToMany(() => LeaveRequest, (leaveRequest: LeaveRequest) => leaveRequest.reviewedBy)
  reviewedLeaveRequests!: LeaveRequest[]
}
