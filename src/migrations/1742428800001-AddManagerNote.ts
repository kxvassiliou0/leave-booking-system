import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddManagerNote1742428800001 implements MigrationInterface {
  name = 'AddManagerNote1742428800001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'leave_request',
      new TableColumn({
        name: 'managerNote',
        type: 'text',
        isNullable: true,
      })
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('leave_request', 'managerNote')
  }
}
