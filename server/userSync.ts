import { helpdeskConnection } from './mysqlDb';
import type { HRMSUser } from './hrmsAuth';

export async function syncUserToCMS(user: HRMSUser) {
  try {
    // First check if user exists
    const [existingRows] = await helpdeskConnection.execute(
      'SELECT cms_user_id FROM cms_user_details WHERE cms_user_id = ?',
      [user.id]
    );

    // Map role to cms_user_type_id
    const roleTypeMap = {
      'super_admin': 99,
      'admin': 1,
      'employee': 3
    };
    const userTypeId = roleTypeMap[user.role] || 3;

    if ((existingRows as any[]).length === 0) {
      // User doesn't exist, create new user
      await helpdeskConnection.execute(
        `INSERT INTO cms_user_details (
          cms_user_id,
          cms_user_username,
          cms_user_firstname,
          cms_user_lastname,
          cms_user_email,
          cms_user_dep_id,
          cms_user_type_id,
          cms_user_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          user.id,
          user.employee_id,
          user.first_name,
          user.last_name || '',
          user.email || '',
          user.department || 1,
          userTypeId
        ]
      );
    } else {
      // User exists, update their details
      await helpdeskConnection.execute(
        `UPDATE cms_user_details 
         SET 
           cms_user_username = ?,
           cms_user_firstname = ?,
           cms_user_lastname = ?,
           cms_user_email = ?,
           cms_user_dep_id = ?,
           cms_user_type_id = ?
         WHERE cms_user_id = ?`,
        [
          user.employee_id,
          user.first_name,
          user.last_name || '',
          user.email || '',
          user.department || 1,
          userTypeId,
          user.id
        ]
      );
    }

    return true;
  } catch (error) {
    console.error('Error syncing user to CMS:', error);
    return false;
  }
}
