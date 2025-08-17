import { and, eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { schema } from "@/database/schema/index";
import { db } from "@/lib/db";
import { Customer, NewCustomer } from "@/database/schema/mikrotik";

export interface CustomerWithDetails {
  id: number;
  username: string;
  password: string | null;
  service_plan_id: number | null;
  router_id: number | null;
  balance: string;
  personal_info: any;
  registration_date: Date | null;
  last_login: Date | null;
  notes: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  is_active: boolean | null;
  created_at: Date;
  updated_at: Date;
  service_plan?: {
    id: number;
    name: string;
    type: string;
    price: string;
  } | null;
  router?: {
    id: number;
    name: string;
    ip_address: string;
  } | null;
}

export async function getCustomerById(id: number): Promise<CustomerWithDetails | null> {
  const customer = await db.query.customers.findFirst({
    where: eq(schema.customers.id, id),
    with: {
      service_plan: {
        columns: {
          id: true,
          name: true,
          type: true,
          price: true,
        },
      },
      router: {
        columns: {
          id: true,
          name: true,
          hostname: true,
        },
      },
    },
  });

  return customer as CustomerWithDetails | null;
}

export async function getCustomerByUsername(username: string): Promise<Customer | null> {
  const result = await db.query.customers.findFirst({
    where: eq(schema.customers.username, username),
  });
  return result || null;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const result = await db.query.customers.findFirst({
    where: eq(schema.customers.email, email),
  });

  return result || null;
}

export async function getAllCustomers(): Promise<CustomerWithDetails[]> {
  const customers = await db.query.customers.findMany({
    with: {
      service_plan: {
        columns: {
          id: true,
          name: true,
          type: true,
          price: true,
        },
      },
      router: {
        columns: {
          id: true,
          name: true,
          hostname: true,
        },
      },
    },
    orderBy: [desc(schema.customers.created_at)],
  });

  return customers as CustomerWithDetails[];
}

export async function getCustomersByRouter(routerId: number): Promise<Customer[]> {
  return await db.query.customers.findMany({
    where: eq(schema.customers.router_id, routerId),
    orderBy: [desc(schema.customers.created_at)],
  });
}

export async function createCustomer(
  data: Omit<NewCustomer, 'id' | 'created_at' | 'updated_at'> & {
    password?: string;
  }
): Promise<Customer> {
  let hashedPassword = null;
  if (data.password) {
    hashedPassword = await bcrypt.hash(data.password, 10);
  }

  const newCustomer: NewCustomer = {
    ...data,
    password: hashedPassword,
    registration_date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const [customer] = await db
    .insert(schema.customers)
    .values(newCustomer)
    .returning();

  return customer;
}

export async function updateCustomer(
  id: number,
  data: Partial<Omit<NewCustomer, 'id' | 'created_at'>> & {
    password?: string;
  }
): Promise<Customer | null> {
  let updateData: any = { ...data };

  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  updateData.updated_at = new Date();

  const [updatedCustomer] = await db
    .update(schema.customers)
    .set(updateData)
    .where(eq(schema.customers.id, id))
    .returning();

  return updatedCustomer || null;
}

export async function deleteCustomer(id: number): Promise<void> {
  await db
    .delete(schema.customers)
    .where(eq(schema.customers.id, id));
}

export async function updateCustomerBalance(
  id: number,
  newBalance: string
): Promise<Customer | null> {
  const [updatedCustomer] = await db
    .update(schema.customers)
    .set({ 
      balance: newBalance,
      updated_at: new Date() 
    })
    .where(eq(schema.customers.id, id))
    .returning();

  return updatedCustomer || null;
}

export async function updateCustomerLastLogin(id: number): Promise<void> {
  await db
    .update(schema.customers)
    .set({ 
      last_login: new Date(),
      updated_at: new Date() 
    })
    .where(eq(schema.customers.id, id));
}