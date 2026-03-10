import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// POST: Login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: user, error: userErr } = await supabase
      .from("hm_users")
      .select("id, name, email, phone, role, password_hash, must_reset_password, is_active")
      .eq("email", email)
      .single();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        must_reset_password: user.must_reset_password,
      },
      mustResetPassword: user.must_reset_password,
    });
  } catch (err) {
    console.error("Hospitality auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Password reset or create user
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Password reset
    if (body.userId) {
      const { userId, newPassword } = body;

      if (!newPassword) {
        return NextResponse.json(
          { error: "newPassword is required" },
          { status: 400 }
        );
      }

      const hash = await bcrypt.hash(newPassword, 10);

      const { error } = await supabase
        .from("hm_users")
        .update({ password_hash: hash, must_reset_password: false })
        .eq("id", userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Create user
    const { name, email, phone, role, password } = body;

    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: "name, email, role, and password are required" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("hm_users").insert({
      name,
      email,
      phone: phone || null,
      role,
      password_hash: hash,
      must_reset_password: true,
      is_active: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Hospitality auth PUT error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
