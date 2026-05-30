# Habit Template & Admin System Architecture

## Overview

The application already supports:

* multi-user authentication
* Google OAuth
* email/password login

Now we want to implement:

1. Admin panel
2. Roles to user and their management
3. Habit Template system
4. Analytics dashboard
5. Platform-managed suggested habits

IMPORTANT:
User-created habits and goals are private and should NOT be visible in admin panels unless specifically required for moderation/support purposes.

The platform should separate:

* User-owned data
* Platform-managed content

---

# Roles

## SystemAdmin

Full platform access.

Permissions:

* manage admins
* manage roles
* manage users
* manage habit templates
* manage categories
* manage featured packs
* view analytics
* suspend users
* access system settings

---

## Admin

Permissions:

* view users
* view analytics
* manage habit templates
* manage categories
* manage packs

Restrictions:

* cannot create admins
* cannot manage roles
* cannot access system settings
* cannot access private user habit data

---

## User

Permissions:

* manage own habits
* manage own goals
* use templates
* customize imported templates

---

# Privacy Rules

Admins should NOT:

* view private habits
* view journal entries
* view personal notes
* inspect user goals
* access sensitive personal tracking data

Admins MAY:

* view aggregate analytics
* view anonymized platform statistics
* moderate accounts if needed

---

# Admin Panel Structure

```txt
Admin Dashboard
├── Overview
├── Users
├── Analytics
├── Habit Templates
├── Categories
├── Featured Packs
├── Activity Logs
├── Roles & Permissions (SystemAdmin only)
└── System Settings (SystemAdmin only)
```

---

# Habit Template System

The platform should provide curated habit suggestions users can quickly add to their account.

Templates are NOT user habits.

Templates are reusable blueprints.

When a user selects a template:

* create a new user-owned habit
* copy template values into the user's habit
* do not link the user habit directly to the template

This prevents shared-state issues.

---

# Habit Template Categories

Suggested default categories:

* Health
* Fitness
* Productivity
* Learning
* Mental Health
* Sleep
* Finance
* Mindfulness
* Career
* Relationships

---

# Example Templates

* Drink Water
* Morning Walk
* Read 10 Pages
* Sleep Before 11PM
* Meditate 5 Minutes
* Workout Daily
* Journal Daily
* Practice Coding
* Track Expenses
* Stretching

---

# Habit Packs

Support collections of habits.

Examples:

* Beginner Productivity Pack
* Morning Routine Pack
* 30-Day Fitness Starter
* Student Focus Pack
* Mental Wellness Basics

Each pack contains multiple templates.

---

# Database Schema

## roles

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```
add all the roles related tables to authorisation schema
---

## user_roles

```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW()
);
```

---

## permissions

```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL
);
```

---

## role_permissions

```sql
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY(role_id, permission_id)
);
```

---

# Habit Template Tables

## habit_template_categories

```sql
CREATE TABLE habit_template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## habit_templates

```sql
CREATE TABLE habit_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES habit_template_categories(id),
    icon VARCHAR(100),
    color VARCHAR(50),
    difficulty VARCHAR(50),
    frequency_type VARCHAR(50),
    default_goal INTEGER,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## habit_template_packs

```sql
CREATE TABLE habit_template_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image TEXT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## habit_template_pack_items

```sql
CREATE TABLE habit_template_pack_items (
    pack_id UUID REFERENCES habit_template_packs(id) ON DELETE CASCADE,
    template_id UUID REFERENCES habit_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY(pack_id, template_id)
);
```

---

# Analytics System

Track analytics through events.

Do NOT build analytics directly from transactional tables.

---

## analytics_events

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_name VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Suggested Analytics Events

* user_signed_up
* login_success
* login_failed
* habit_created
* habit_completed
* habit_deleted
* template_imported
* pack_imported
* streak_started
* streak_broken

---

# Admin Dashboard Analytics

## Overview Metrics

* Total users
* Active users today
* Weekly active users
* Monthly active users
* New signups
* Habit completion rate
* Template adoption rate
* Most popular templates
* Most active categories

---

# Important Product Analytics

## Retention

Track:

* Day 1 retention
* Day 7 retention
* Day 30 retention

---

## Template Analytics

Track:

* templates added most often
* templates with highest completion rates
* templates abandoned quickly

Example:

Morning Walk

* added by 4200 users
* 67% 7-day retention

---

# Admin Users Page

Admins can view:

* name
* email
* signup date
* last active
* role
* status

SystemAdmin actions:

* promote to admin
* suspend user
* reactivate user

Admin actions:

* view users only

---

# Permission Middleware

Implement middleware guards.

Example permissions:

* manage_users
* manage_roles
* manage_templates
* manage_categories
* manage_packs
* view_analytics
* manage_system_settings

Never hardcode admin checks directly.

Use permission-based access control.

---

# API Security

Requirements:

* validate all inputs
* rate limit auth endpoints
* secure admin routes
* sanitize user content
* use server-side authorization checks
* never trust frontend role checks

---

# Suggested Admin UI Structure

```txt
/admin
├── dashboard
├── users
├── analytics
├── templates
├── templates/create
├── templates/[id]
├── categories
├── packs
├── roles
└── settings
```

---

# Recommended Architecture Principles

1. User habits are private
2. Templates are platform-managed
3. Analytics should be event-driven
4. Roles should be permission-based
5. Admin access must be secure
6. Separate platform content from user data
7. Build scalable SaaS-ready architecture

---

# Future Expansion

Prepare architecture for:

* subscriptions
* AI recommendations
* team workspaces
* social features
* public habit sharing
* notifications
* gamification
* achievement systems
* recommendation engine

---

# Recommended Implementation Order

1. RBAC system
2. Permission middleware
3. Admin routes/layout
4. Users page
5. Habit template system
6. Categories & packs
7. Analytics event tracking
8. Dashboard analytics
9. Advanced retention analytics
10. Recommendation system
