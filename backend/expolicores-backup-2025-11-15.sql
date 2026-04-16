--
-- PostgreSQL database dump
--

\restrict OjUBp2ZNZdhPBm982MPO1ZH0EevyFwmggvahG0zKfbRKP4RGIy77OOktvERK71g

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: shadow_prisma; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA shadow_prisma;


ALTER SCHEMA shadow_prisma OWNER TO postgres;

--
-- Name: AdminProcessStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AdminProcessStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'ATTENDED'
);


ALTER TYPE public."AdminProcessStatus" OWNER TO postgres;

--
-- Name: BusinessVerificationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BusinessVerificationStatus" AS ENUM (
    'NONE',
    'SUBMITTED',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."BusinessVerificationStatus" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'RECIBIDO',
    'EN_CAMINO',
    'ENTREGADO',
    'CANCELADO'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: PromotionAudience; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PromotionAudience" AS ENUM (
    'ANY',
    'B2C',
    'B2B'
);


ALTER TYPE public."PromotionAudience" OWNER TO postgres;

--
-- Name: PromotionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PromotionType" AS ENUM (
    'PRICE_OVERRIDE',
    'PERCENT_OFF',
    'X_FOR_Y',
    'GIFT_WITH_PURCHASE'
);


ALTER TYPE public."PromotionType" OWNER TO postgres;

--
-- Name: PushPlatform; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PushPlatform" AS ENUM (
    'ios',
    'android'
);


ALTER TYPE public."PushPlatform" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'B2C',
    'B2B'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: shadow_prisma; Owner: postgres
--

CREATE TYPE shadow_prisma."OrderStatus" AS ENUM (
    'RECIBIDO',
    'EN_CAMINO',
    'ENTREGADO',
    'CANCELADO'
);


ALTER TYPE shadow_prisma."OrderStatus" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: shadow_prisma; Owner: postgres
--

CREATE TYPE shadow_prisma."Role" AS ENUM (
    'ADMIN',
    'CLIENTE',
    'NEGOCIO'
);


ALTER TYPE shadow_prisma."Role" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Address; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Address" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    label text NOT NULL,
    recipient text NOT NULL,
    phone text NOT NULL,
    line1 text NOT NULL,
    line2 text,
    neighborhood text,
    city text DEFAULT 'Villa de Leyva'::text NOT NULL,
    state text DEFAULT 'Boyacá'::text NOT NULL,
    country text DEFAULT 'CO'::text NOT NULL,
    lat double precision,
    lng double precision,
    notes text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Address" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Address_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Address_id_seq" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Address_id_seq" OWNED BY public."Address".id;


--
-- Name: BundleMap; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BundleMap" (
    "bundleId" text NOT NULL,
    components jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BundleMap" OWNER TO postgres;

--
-- Name: EmailOtp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EmailOtp" (
    id text NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "requestIp" text
);


ALTER TABLE public."EmailOtp" OWNER TO postgres;

--
-- Name: EmailVerificationToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EmailVerificationToken" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone
);


ALTER TABLE public."EmailVerificationToken" OWNER TO postgres;

--
-- Name: EmailVerificationToken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."EmailVerificationToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EmailVerificationToken_id_seq" OWNER TO postgres;

--
-- Name: EmailVerificationToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."EmailVerificationToken_id_seq" OWNED BY public."EmailVerificationToken".id;


--
-- Name: Favorite; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Favorite" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "productId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Favorite" OWNER TO postgres;

--
-- Name: Favorite_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Favorite_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Favorite_id_seq" OWNER TO postgres;

--
-- Name: Favorite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Favorite_id_seq" OWNED BY public."Favorite".id;


--
-- Name: IdempotencyKey; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."IdempotencyKey" (
    key text NOT NULL,
    "orderId" integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."IdempotencyKey" OWNER TO postgres;

--
-- Name: NotificationLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationLog" (
    id integer NOT NULL,
    "orderId" integer,
    channel text,
    type text NOT NULL,
    sid text,
    ok boolean DEFAULT false NOT NULL,
    error text,
    "to" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "errorCode" text,
    "messageSid" text,
    payload jsonb
);


ALTER TABLE public."NotificationLog" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."NotificationLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."NotificationLog_id_seq" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."NotificationLog_id_seq" OWNED BY public."NotificationLog".id;


--
-- Name: Order; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Order" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    total double precision NOT NULL,
    status public."OrderStatus" DEFAULT 'RECIBIDO'::public."OrderStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Order" OWNER TO postgres;

--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrderItem" (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "productId" integer NOT NULL,
    quantity integer NOT NULL
);


ALTER TABLE public."OrderItem" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."OrderItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."OrderItem_id_seq" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."OrderItem_id_seq" OWNED BY public."OrderItem".id;


--
-- Name: OrderLiveActivity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrderLiveActivity" (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "userId" integer NOT NULL,
    "activityId" text NOT NULL,
    "pushToken" text NOT NULL,
    "isEnded" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."OrderLiveActivity" OWNER TO postgres;

--
-- Name: OrderLiveActivity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."OrderLiveActivity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."OrderLiveActivity_id_seq" OWNER TO postgres;

--
-- Name: OrderLiveActivity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."OrderLiveActivity_id_seq" OWNED BY public."OrderLiveActivity".id;


--
-- Name: Order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Order_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Order_id_seq" OWNER TO postgres;

--
-- Name: Order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Order_id_seq" OWNED BY public."Order".id;


--
-- Name: Product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Product" (
    id integer NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    "b2bPrice" integer DEFAULT 0 NOT NULL,
    stock integer NOT NULL,
    description text NOT NULL,
    "imageUrl" text,
    category character varying(64),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Product" OWNER TO postgres;

--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Product_id_seq" OWNER TO postgres;

--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Product_id_seq" OWNED BY public."Product".id;


--
-- Name: Promotion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Promotion" (
    id text NOT NULL,
    name text NOT NULL,
    type public."PromotionType" NOT NULL,
    audience public."PromotionAudience" DEFAULT 'ANY'::public."PromotionAudience" NOT NULL,
    active boolean DEFAULT true NOT NULL,
    stacking boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    "conditionsJson" jsonb,
    "benefitsJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Promotion" OWNER TO postgres;

--
-- Name: PromotionProduct; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PromotionProduct" (
    id text NOT NULL,
    "promotionId" text NOT NULL,
    "minQty" integer,
    "productId" integer NOT NULL
);


ALTER TABLE public."PromotionProduct" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text DEFAULT 'Cliente'::text NOT NULL,
    email text,
    phone text,
    password text,
    role public."Role" DEFAULT 'B2C'::public."Role" NOT NULL,
    "isPhoneVerified" boolean DEFAULT false NOT NULL,
    "isEmailVerified" boolean DEFAULT false NOT NULL,
    "otpCodeHash" text,
    "otpExpiresAt" timestamp(3) without time zone,
    "lastOtpSentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "adminProcessStatus" public."AdminProcessStatus" DEFAULT 'PENDING'::public."AdminProcessStatus" NOT NULL,
    "businessVerificationStatus" public."BusinessVerificationStatus" DEFAULT 'NONE'::public."BusinessVerificationStatus" NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserPushToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserPushToken" (
    id text NOT NULL,
    "userId" integer NOT NULL,
    token text NOT NULL,
    platform public."PushPlatform" NOT NULL,
    "lastUsedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."UserPushToken" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Address; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."Address" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    label text NOT NULL,
    recipient text NOT NULL,
    phone text NOT NULL,
    line1 text NOT NULL,
    line2 text,
    neighborhood text,
    city text DEFAULT 'Villa de Leyva'::text NOT NULL,
    state text DEFAULT 'Boyacá'::text NOT NULL,
    country text DEFAULT 'CO'::text NOT NULL,
    lat double precision,
    lng double precision,
    notes text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow_prisma."Address" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."Address_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."Address_id_seq" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."Address_id_seq" OWNED BY shadow_prisma."Address".id;


--
-- Name: Favorite; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."Favorite" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "productId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE shadow_prisma."Favorite" OWNER TO postgres;

--
-- Name: Favorite_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."Favorite_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."Favorite_id_seq" OWNER TO postgres;

--
-- Name: Favorite_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."Favorite_id_seq" OWNED BY shadow_prisma."Favorite".id;


--
-- Name: IdempotencyKey; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."IdempotencyKey" (
    key text NOT NULL,
    "orderId" integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow_prisma."IdempotencyKey" OWNER TO postgres;

--
-- Name: NotificationLog; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."NotificationLog" (
    id integer NOT NULL,
    "orderId" integer,
    type text NOT NULL,
    "to" text,
    sid text,
    ok boolean NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    channel text DEFAULT 'WHATSAPP'::text NOT NULL
);


ALTER TABLE shadow_prisma."NotificationLog" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."NotificationLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."NotificationLog_id_seq" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."NotificationLog_id_seq" OWNED BY shadow_prisma."NotificationLog".id;


--
-- Name: Order; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."Order" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" integer NOT NULL,
    total double precision NOT NULL,
    status shadow_prisma."OrderStatus" DEFAULT 'RECIBIDO'::shadow_prisma."OrderStatus" NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE shadow_prisma."Order" OWNER TO postgres;

--
-- Name: OrderItem; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."OrderItem" (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "productId" integer NOT NULL,
    quantity integer NOT NULL
);


ALTER TABLE shadow_prisma."OrderItem" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."OrderItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."OrderItem_id_seq" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."OrderItem_id_seq" OWNED BY shadow_prisma."OrderItem".id;


--
-- Name: Order_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."Order_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."Order_id_seq" OWNER TO postgres;

--
-- Name: Order_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."Order_id_seq" OWNED BY shadow_prisma."Order".id;


--
-- Name: Product; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."Product" (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    stock integer NOT NULL,
    category character varying(64),
    "imageUrl" text,
    "b2bPrice" integer DEFAULT 0 NOT NULL
);


ALTER TABLE shadow_prisma."Product" OWNER TO postgres;

--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."Product_id_seq" OWNER TO postgres;

--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."Product_id_seq" OWNED BY shadow_prisma."Product".id;


--
-- Name: RefreshToken; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."RefreshToken" (
    id text NOT NULL,
    "userId" integer NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "replacedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE shadow_prisma."RefreshToken" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: shadow_prisma; Owner: postgres
--

CREATE TABLE shadow_prisma."User" (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    phone text DEFAULT '0000000000'::text NOT NULL,
    role shadow_prisma."Role" DEFAULT 'CLIENTE'::shadow_prisma."Role" NOT NULL,
    "emailAlt" text
);


ALTER TABLE shadow_prisma."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: shadow_prisma; Owner: postgres
--

CREATE SEQUENCE shadow_prisma."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow_prisma."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow_prisma; Owner: postgres
--

ALTER SEQUENCE shadow_prisma."User_id_seq" OWNED BY shadow_prisma."User".id;


--
-- Name: Address id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address" ALTER COLUMN id SET DEFAULT nextval('public."Address_id_seq"'::regclass);


--
-- Name: EmailVerificationToken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailVerificationToken" ALTER COLUMN id SET DEFAULT nextval('public."EmailVerificationToken_id_seq"'::regclass);


--
-- Name: Favorite id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Favorite" ALTER COLUMN id SET DEFAULT nextval('public."Favorite_id_seq"'::regclass);


--
-- Name: NotificationLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog" ALTER COLUMN id SET DEFAULT nextval('public."NotificationLog_id_seq"'::regclass);


--
-- Name: Order id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order" ALTER COLUMN id SET DEFAULT nextval('public."Order_id_seq"'::regclass);


--
-- Name: OrderItem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem" ALTER COLUMN id SET DEFAULT nextval('public."OrderItem_id_seq"'::regclass);


--
-- Name: OrderLiveActivity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderLiveActivity" ALTER COLUMN id SET DEFAULT nextval('public."OrderLiveActivity_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Address id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Address" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."Address_id_seq"'::regclass);


--
-- Name: Favorite id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Favorite" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."Favorite_id_seq"'::regclass);


--
-- Name: NotificationLog id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."NotificationLog" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."NotificationLog_id_seq"'::regclass);


--
-- Name: Order id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Order" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."Order_id_seq"'::regclass);


--
-- Name: OrderItem id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."OrderItem" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."OrderItem_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Product" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."Product_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."User" ALTER COLUMN id SET DEFAULT nextval('shadow_prisma."User_id_seq"'::regclass);


--
-- Data for Name: Address; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Address" (id, "userId", label, recipient, phone, line1, line2, neighborhood, city, state, country, lat, lng, notes, "isDefault", "createdAt", "updatedAt") FROM stdin;
3	1	ADMIN	Admin	3505336910	Frente a La Periquera, Vía Gachantivá, Arcabuco, Gachantivá, Boyacá, Colombia	\N	\N	Villa de Leyva	Boyacá	CO	5.721388	-73.5244414	\N	t	2025-10-21 03:42:56.642	2025-11-01 16:44:28.129
5	2	Casa hotel los angeles	Casa hotel los angeles	310000000	Cl. 7b #6a - 33, Villa de Leyva, Boyacá, Colombia	Ok - 201	\N	Villa de Leyva	Boyacá	CO	5.6283925	-73.5254977	\N	f	2025-10-30 02:03:49.689	2025-11-01 16:44:51.263
2	2	B2C	Don Pepe	3001112233	Calle 8 # 7-21	\N	Norte	Villa de Leyva	Boyacá	CO	5.638	-73.529	\N	t	2025-10-21 03:10:08.273	2025-11-01 16:44:51.265
6	3	Admin	Casa san pedro	3112585858	Villa de Leyva - Arcabuco #kilometro 2,5, Villa de Leyva, Boyacá, Colombia	Ok	\N	Villa de Leyva	Boyacá	CO	5.6575456	-73.51501410000002	\N	f	2025-10-30 02:15:14.079	2025-11-02 03:50:38.176
1	3	B2C	Juan Cliente	3114445566	Cra. 9 #11-55, Villa de Leyva, Boyacá, Colombia	\N	Centro	Villa de Leyva	Boyacá	CO	5.6328827	-73.5239596	\N	t	2025-10-21 03:10:08.273	2025-11-02 03:50:38.179
9	90	Arandanos	Arandanos	3125469782	Cra. 9 #8-35, Villa de Leyva, Boyacá, Colombia	Arandanos - Arandanos	\N	Villa de Leyva	Boyacá	CO	5.6309036	-73.5264057	\N	f	2025-11-14 21:57:54.481	2025-11-14 22:36:29.566
10	90	La galleta	La galleta	3215649405	Cra. 9 #11 47, Villa de Leyva, Boyacá, Colombia	La galleta - La galleta	\N	Villa de Leyva	Boyacá	CO	5.6328151	-73.5240346	\N	t	2025-11-14 22:36:29.569	2025-11-14 22:36:29.569
4	1	Viñedo Ain Karim	Juan	3505336910	Sutamarchan - Sta. Sofia #Km 5, Sutamarchán, Boyacá, Colombia	Viñedo ain Karim	\N	Villa de Leyva	Boyacá	CO	5.6539515	-73.5875274	\N	f	2025-10-22 05:20:29.521	2025-11-01 16:44:28.126
\.


--
-- Data for Name: BundleMap; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BundleMap" ("bundleId", components, active, notes, "createdAt", "updatedAt") FROM stdin;
1001	[{"qty": 3, "productId": "3"}]	t	\N	2025-11-02 02:43:27.474	2025-11-02 02:43:27.474
1002	[{"qty": 1, "productId": "50"}, {"qty": 1, "productId": "99"}]	t	\N	2025-11-02 02:43:28.11	2025-11-02 02:43:28.11
1003	[{"qty": 6, "productId": "6"}]	t	\N	2025-11-02 03:58:46.931	2025-11-02 03:58:46.931
1004	[{"qty": 1, "productId": "50"}]	t	\N	2025-11-02 04:06:35.828	2025-11-02 04:06:35.828
1010	[{"qty": 5, "productId": "1010"}]	t	\N	2025-11-02 16:21:37.69	2025-11-02 16:21:37.69
1011	[{"qty": 1, "productId": "1011"}, {"qty": 1, "productId": "99"}]	t	\N	2025-11-02 16:22:12.151	2025-11-02 16:22:12.151
1009	[{"qty": 1, "productId": "18"}, {"qty": 1, "productId": "20"}]	t	\N	2025-11-02 04:07:37.871	2025-11-15 03:00:12.669
\.


--
-- Data for Name: EmailOtp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EmailOtp" (id, email, code, "expiresAt", attempts, "consumedAt", "createdAt", "requestIp") FROM stdin;
\.


--
-- Data for Name: EmailVerificationToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EmailVerificationToken" (id, "userId", token, "expiresAt", "usedAt") FROM stdin;
1	1	26e2f63ecef1b6bb6471e7a61bb31c1d81e0a935105d15db	2025-10-22 03:36:50.114	\N
4	90	f60de88685f117c2f29105a9cfa09627cc39b7a16b040c58	2025-11-15 02:43:46.78	\N
\.


--
-- Data for Name: Favorite; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Favorite" (id, "userId", "productId", "createdAt") FROM stdin;
3	3	9	2025-10-21 03:10:08.717
8	2	46	2025-10-30 03:22:26.48
4	1	31	2025-10-24 00:20:56.522
5	1	58	2025-10-24 00:20:57.166
6	1	49	2025-10-24 00:20:58.175
10	1	10	2025-11-01 18:18:43.361
11	1	9	2025-11-01 18:18:44.019
13	3	1003	2025-11-08 16:00:05.263
14	3	26	2025-11-08 16:02:44.816
16	2	33	2025-11-08 16:05:53.088
17	2	47	2025-11-08 16:05:53.789
18	2	49	2025-11-08 16:05:55.733
19	1	1009	2025-11-08 23:27:14.934
20	1	1003	2025-11-08 23:27:16.193
\.


--
-- Data for Name: IdempotencyKey; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."IdempotencyKey" (key, "orderId", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: NotificationLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."NotificationLog" (id, "orderId", channel, type, sid, ok, error, "to", "createdAt", "errorCode", "messageSid", payload) FROM stdin;
302	94	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-11 03:36:49.542	\N	\N	\N
314	95	\N	STATUS_ENTREGADO	\N	f	send failed	+573053233975	2025-11-13 02:59:36.01	\N	\N	\N
326	98	\N	ORDER_CONFIRMATION	\N	f	disabled	+573053233975	2025-11-13 13:32:40.915	\N	\N	\N
327	98	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573053233975	2025-11-13 13:32:40.922	\N	\N	\N
332	99	\N	STATUS_ENTREGADO	\N	f	send failed	+573053233975	2025-11-13 17:05:20.935	\N	\N	\N
338	101	\N	STATUS_CANCELADO	\N	f	send failed	+573115026310	2025-11-15 03:02:08.663	\N	\N	\N
344	103	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-16 01:02:15.16	\N	\N	\N
345	103	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-16 01:02:15.167	\N	\N	\N
346	103	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-16 01:02:42.579	\N	\N	\N
348	103	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-16 01:02:44.927	\N	\N	\N
66	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 22:22:44.961	\N	\N	\N
308	92	\N	STATUS_CANCELADO	\N	f	send failed	+573505336910	2025-11-11 03:37:50.077	\N	\N	\N
294	91	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-11 03:00:42.717	\N	\N	\N
295	91	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-11 03:00:42.725	\N	\N	\N
304	94	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-11 03:37:20.23	\N	\N	\N
306	93	\N	STATUS_CANCELADO	\N	f	send failed	+573505336910	2025-11-11 03:37:46.879	\N	\N	\N
310	91	\N	STATUS_CANCELADO	\N	f	send failed	+573505336910	2025-11-11 03:37:52.996	\N	\N	\N
316	96	\N	ORDER_CONFIRMATION	\N	f	disabled	+573053233975	2025-11-13 03:07:41.105	\N	\N	\N
317	96	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573053233975	2025-11-13 03:07:41.111	\N	\N	\N
328	98	\N	STATUS_EN_CAMINO	\N	f	send failed	+573053233975	2025-11-13 13:48:05.08	\N	\N	\N
334	100	\N	ORDER_CONFIRMATION	\N	f	disabled	+573115026310	2025-11-14 01:15:10.891	\N	\N	\N
335	100	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573115026310	2025-11-14 01:15:10.901	\N	\N	\N
340	102	\N	ORDER_CONFIRMATION	\N	f	disabled	+573115026310	2025-11-15 03:14:30.187	\N	\N	\N
341	102	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573115026310	2025-11-15 03:14:30.203	\N	\N	\N
98	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-08 17:08:33.045	\N	\N	\N
99	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-08 17:08:33.053	\N	\N	\N
100	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-08 17:09:36.939	\N	\N	\N
102	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-08 17:09:49.537	\N	\N	\N
116	\N	\N	STATUS_CANCELADO	\N	f	send failed	+573505336910	2025-11-08 17:22:43.26	\N	\N	\N
67	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 22:22:44.969	\N	\N	\N
68	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-05 22:23:04.698	\N	\N	\N
70	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-05 22:23:06.865	\N	\N	\N
72	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 23:15:05.102	\N	\N	\N
73	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 23:15:05.115	\N	\N	\N
74	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-05 23:15:16.297	\N	\N	\N
76	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-05 23:15:18.481	\N	\N	\N
82	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-06 17:01:43.725	\N	\N	\N
83	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-06 17:01:43.772	\N	\N	\N
84	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-06 17:02:06.677	\N	\N	\N
86	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-06 17:02:31.636	\N	\N	\N
92	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-08 16:04:13.731	\N	\N	\N
93	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-08 16:04:13.738	\N	\N	\N
94	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-08 16:04:58.773	\N	\N	\N
106	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-08 17:10:09.111	\N	\N	\N
88	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-07 16:04:49.104	\N	\N	\N
89	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-07 16:04:49.118	\N	\N	\N
110	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-08 17:10:13.987	\N	\N	\N
78	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-06 05:32:11.137	\N	\N	\N
79	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-06 05:32:11.145	\N	\N	\N
80	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-06 05:32:24.023	\N	\N	\N
112	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-08 17:10:17.346	\N	\N	\N
52	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 03:05:03.126	\N	\N	\N
53	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 03:05:03.134	\N	\N	\N
114	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-08 17:10:21.729	\N	\N	\N
4	\N	\N	ORDER_CONFIRMATION	MMdbfb306466a51097c310e7933f58d22d	t	\N	whatsapp:+573505336910	2025-10-21 03:43:09.516	\N	\N	\N
5	\N	WHATSAPP	ORDER_CREATED	MMdbfb306466a51097c310e7933f58d22d	t	\N	+573505336910	2025-10-21 03:43:09.724	\N	\N	\N
6	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-10-21 03:43:24.743	\N	\N	\N
8	\N	\N	ORDER_CONFIRMATION	MM4dd39f9b78ffe6cf34dda0638b9edd1d	t	\N	whatsapp:+573505336910	2025-10-22 05:21:01.711	\N	\N	\N
9	\N	WHATSAPP	ORDER_CREATED	MM4dd39f9b78ffe6cf34dda0638b9edd1d	t	\N	+573505336910	2025-10-22 05:21:02.034	\N	\N	\N
10	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-10-22 05:21:13.885	\N	\N	\N
12	\N	\N	ORDER_CONFIRMATION	MMc158912f032ab05c89b1b29166ac4515	t	\N	whatsapp:+573505336910	2025-10-23 04:03:00.204	\N	\N	\N
13	\N	WHATSAPP	ORDER_CREATED	MMc158912f032ab05c89b1b29166ac4515	t	\N	+573505336910	2025-10-23 04:03:00.412	\N	\N	\N
14	\N	\N	ORDER_CONFIRMATION	MMe29402a479c3b5f0b4bdd062cb260cc3	t	\N	whatsapp:+573505336910	2025-10-23 04:04:23.68	\N	\N	\N
15	\N	WHATSAPP	ORDER_CREATED	MMe29402a479c3b5f0b4bdd062cb260cc3	t	\N	+573505336910	2025-10-23 04:04:23.892	\N	\N	\N
16	\N	\N	ORDER_CONFIRMATION	MMbf21b092f40c655206ac03607fcc27e6	t	\N	whatsapp:+573505336910	2025-10-23 04:04:51.876	\N	\N	\N
17	\N	WHATSAPP	ORDER_CREATED	MMbf21b092f40c655206ac03607fcc27e6	t	\N	+573505336910	2025-10-23 04:04:52.113	\N	\N	\N
18	\N	\N	ORDER_CONFIRMATION	MM5fe89897d83e98604847bef9fcb48993	t	\N	whatsapp:+573505336910	2025-10-23 04:05:54.882	\N	\N	\N
19	\N	WHATSAPP	ORDER_CREATED	MM5fe89897d83e98604847bef9fcb48993	t	\N	+573505336910	2025-10-23 04:05:54.99	\N	\N	\N
20	\N	\N	ORDER_CONFIRMATION	MMc1904b5ddb9860c6773ac1dc3517e20b	t	\N	whatsapp:+573505336910	2025-10-23 04:07:06.551	\N	\N	\N
21	\N	WHATSAPP	ORDER_CREATED	MMc1904b5ddb9860c6773ac1dc3517e20b	t	\N	+573505336910	2025-10-23 04:07:06.654	\N	\N	\N
22	\N	\N	ORDER_CONFIRMATION	MMc6b78865e0c0b5d7f439f7a828419257	t	\N	whatsapp:+573505336910	2025-10-23 05:02:27.779	\N	\N	\N
23	\N	WHATSAPP	ORDER_CREATED	MMc6b78865e0c0b5d7f439f7a828419257	t	\N	+573505336910	2025-10-23 05:02:27.992	\N	\N	\N
24	\N	\N	ORDER_CONFIRMATION	MM0f5f6304a87282071882f6b95fda294b	t	\N	whatsapp:+573505336910	2025-10-23 05:03:58.357	\N	\N	\N
25	\N	WHATSAPP	ORDER_CREATED	MM0f5f6304a87282071882f6b95fda294b	t	\N	+573505336910	2025-10-23 05:03:58.574	\N	\N	\N
26	\N	\N	ORDER_CONFIRMATION	MM8b42b616e7ad379d12d3b02eff592284	t	\N	whatsapp:+573505336910	2025-10-23 05:04:20.58	\N	\N	\N
27	\N	WHATSAPP	ORDER_CREATED	MM8b42b616e7ad379d12d3b02eff592284	t	\N	+573505336910	2025-10-23 05:04:20.872	\N	\N	\N
28	\N	\N	ORDER_CONFIRMATION	MM350ffa47e3d0150acb093b99c55b53ee	t	\N	whatsapp:+573505336910	2025-10-23 05:21:04.598	\N	\N	\N
29	\N	WHATSAPP	ORDER_CREATED	MM350ffa47e3d0150acb093b99c55b53ee	t	\N	+573505336910	2025-10-23 05:21:04.808	\N	\N	\N
30	\N	\N	ORDER_CONFIRMATION	MM7f7b6235f4932a04ced6336364bf4524	t	\N	whatsapp:+573505336910	2025-10-23 05:21:42.043	\N	\N	\N
31	\N	WHATSAPP	ORDER_CREATED	MM7f7b6235f4932a04ced6336364bf4524	t	\N	+573505336910	2025-10-23 05:21:42.27	\N	\N	\N
32	\N	\N	ORDER_CONFIRMATION	MM1997d6e3f4cbd5544b023173eb16a043	t	\N	whatsapp:+573505336910	2025-10-24 00:24:53.024	\N	\N	\N
33	\N	WHATSAPP	ORDER_CREATED	MM1997d6e3f4cbd5544b023173eb16a043	t	\N	+573505336910	2025-10-24 00:24:53.202	\N	\N	\N
34	\N	\N	ORDER_CONFIRMATION	MMf2b4698909cc4bdae6ff89b2db54f5f7	t	\N	whatsapp:+573505336910	2025-10-24 00:25:29.854	\N	\N	\N
35	\N	WHATSAPP	ORDER_CREATED	MMf2b4698909cc4bdae6ff89b2db54f5f7	t	\N	+573505336910	2025-10-24 00:25:30.054	\N	\N	\N
36	\N	\N	ORDER_CONFIRMATION	MM7d584a1cbc1772d3be73ae99619cb1fb	t	\N	whatsapp:+573505336910	2025-10-25 21:55:17.446	\N	\N	\N
37	\N	WHATSAPP	ORDER_CREATED	MM7d584a1cbc1772d3be73ae99619cb1fb	t	\N	+573505336910	2025-10-25 21:55:17.636	\N	\N	\N
42	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-02 16:01:14.481	\N	\N	\N
43	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-02 16:01:14.49	\N	\N	\N
46	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-04 05:08:01.686	\N	\N	\N
47	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-04 05:08:01.696	\N	\N	\N
48	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-04 05:14:22.747	\N	\N	\N
49	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-04 05:14:22.758	\N	\N	\N
50	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 02:59:00.099	\N	\N	\N
51	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 02:59:00.107	\N	\N	\N
54	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 03:07:02.42	\N	\N	\N
55	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 03:07:02.426	\N	\N	\N
56	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-05 03:25:57.576	\N	\N	\N
58	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-05 03:25:59.964	\N	\N	\N
60	\N	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-05 20:50:23.771	\N	\N	\N
61	\N	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-05 20:50:23.78	\N	\N	\N
62	\N	\N	STATUS_EN_CAMINO	\N	f	send failed	+573505336910	2025-11-05 20:50:48.162	\N	\N	\N
64	\N	\N	STATUS_ENTREGADO	\N	f	send failed	+573505336910	2025-11-05 20:50:53.196	\N	\N	\N
296	92	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-11 03:03:22.699	\N	\N	\N
297	92	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-11 03:03:22.705	\N	\N	\N
298	93	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-11 03:04:38.66	\N	\N	\N
299	93	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-11 03:04:38.664	\N	\N	\N
300	94	\N	ORDER_CONFIRMATION	\N	f	disabled	+573505336910	2025-11-11 03:07:17.655	\N	\N	\N
301	94	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573505336910	2025-11-11 03:07:17.663	\N	\N	\N
312	95	\N	ORDER_CONFIRMATION	\N	f	disabled	+573053233975	2025-11-11 04:23:44.981	\N	\N	\N
313	95	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573053233975	2025-11-11 04:23:44.991	\N	\N	\N
318	96	\N	STATUS_CANCELADO	\N	f	send failed	+573053233975	2025-11-13 04:46:08.148	\N	\N	\N
320	97	\N	ORDER_CONFIRMATION	\N	f	disabled	+573053233975	2025-11-13 04:46:27.09	\N	\N	\N
321	97	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573053233975	2025-11-13 04:46:27.097	\N	\N	\N
322	97	\N	STATUS_EN_CAMINO	\N	f	send failed	+573053233975	2025-11-13 04:46:55.805	\N	\N	\N
324	97	\N	STATUS_ENTREGADO	\N	f	send failed	+573053233975	2025-11-13 04:47:21.958	\N	\N	\N
330	99	\N	ORDER_CONFIRMATION	\N	f	disabled	+573053233975	2025-11-13 13:50:31.183	\N	\N	\N
331	99	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573053233975	2025-11-13 13:50:31.197	\N	\N	\N
336	101	\N	ORDER_CONFIRMATION	\N	f	disabled	+573115026310	2025-11-14 22:27:43.958	\N	\N	\N
337	101	WHATSAPP	ORDER_CREATED	\N	f	send failed	+573115026310	2025-11-14 22:27:43.965	\N	\N	\N
342	102	\N	STATUS_EN_CAMINO	\N	f	send failed	+573115026310	2025-11-15 03:15:59.125	\N	\N	\N
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Order" (id, "userId", total, status, "createdAt", "updatedAt") FROM stdin;
102	90	362000	EN_CAMINO	2025-11-15 03:14:30.083	2025-11-15 03:15:59.029
103	1	419250	ENTREGADO	2025-11-16 01:02:14.903	2025-11-16 01:02:44.818
94	1	15190	ENTREGADO	2025-11-11 03:07:17.533	2025-11-11 03:37:20.125
93	1	19263	CANCELADO	2025-11-11 03:04:38.557	2025-11-11 03:37:46.787
92	1	47350	CANCELADO	2025-11-11 03:03:22.607	2025-11-11 03:37:50.001
91	1	15190	CANCELADO	2025-11-11 03:00:42.569	2025-11-11 03:37:52.911
95	2	47000	ENTREGADO	2025-11-11 04:23:44.88	2025-11-13 02:59:35.901
96	2	245000	CANCELADO	2025-11-13 03:07:41.004	2025-11-13 04:46:08.013
97	2	26000	ENTREGADO	2025-11-13 04:46:27.001	2025-11-13 04:47:21.859
98	2	24851	CANCELADO	2025-11-13 13:32:40.672	2025-11-13 13:50:01.956
99	2	128500	ENTREGADO	2025-11-13 13:50:31.043	2025-11-13 17:05:20.763
100	89	245000	RECIBIDO	2025-11-14 01:15:10.866	2025-11-14 01:15:10.866
101	90	154000	CANCELADO	2025-11-14 22:27:43.927	2025-11-15 03:02:08.522
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrderItem" (id, "orderId", "productId", quantity) FROM stdin;
171	91	11	1
172	92	4	1
173	93	59	1
174	94	11	1
175	95	4	1
176	96	16	2
177	97	2	6
178	98	57	3
179	99	16	1
180	99	12	1
181	100	16	2
182	101	10	1
183	102	1009	1
184	102	5	1
185	102	10	1
186	102	11	1
187	103	1009	1
188	103	5	1
189	103	10	1
190	103	11	1
191	103	17	1
192	103	50	1
\.


--
-- Data for Name: OrderLiveActivity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrderLiveActivity" (id, "orderId", "userId", "activityId", "pushToken", "isEnded", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Product" (id, name, price, "b2bPrice", stock, description, "imageUrl", category, "createdAt", "updatedAt") FROM stdin;
25	Producto 9	2233	1786	14	Demo #9	https://picsum.photos/seed/p9/600/600	Cerveza	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
19	Budweiser Sixpac	18000	18000	10	una cerveza de tipo American Lager, caracterizada por su sabor refrescante, equilibrio y color dorado	https://picsum.photos/seed/p3/600/600	Cerveza	2025-10-21 03:10:07.837	2025-11-15 01:58:26.997
55	Producto 39	5000	5074	9	Demo #39	https://picsum.photos/seed/p39/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-10-30 00:40:48.484
50	Perruanas	45000	45000	9	Las mejores ruanas para tu perro	https://picsum.photos/seed/p34/600/600	Artesanias	2025-10-21 03:10:07.837	2025-11-16 01:02:14.944
7	Ron Viejo de Caldas 8 años 750ml	69000	60000	0	8 años	https://picsum.photos/seed/caldas/600/600	Ron	2025-10-21 03:10:06.743	2025-11-10 04:59:36.058
28	Producto 12	2644	2115	15	Demo #12	https://picsum.photos/seed/p12/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-11-10 05:24:17.489
33	Producto 17	3329	2663	21	Demo #17	https://picsum.photos/seed/p17/600/600	Tequila	2025-10-21 03:10:07.837	2025-10-23 04:02:59.054
3	Mojito Coctel (Ron Caldas)	15000	15000	59	Coctel a base de ron con cola	https://picsum.photos/seed/corona/600/600	Coctel	2025-10-21 03:10:06.308	2025-11-15 02:05:02.789
51	Imanes Villa Iglesia	8000	8000	10	Iman de Villa de Leyva con esquema iglesia	https://picsum.photos/seed/p35/600/600	Artesanias	2025-10-21 03:10:07.837	2025-11-15 02:12:52.031
59	Producto 43	6891	5513	13	Demo #43	https://picsum.photos/seed/p43/600/600	Vodka	2025-10-21 03:10:07.837	2025-11-11 03:04:38.564
54	Producto 38	6206	4965	3	Demo #38	https://picsum.photos/seed/p38/600/600	Ron	2025-10-21 03:10:07.837	2025-11-08 23:23:32.143
48	Producto 32	5384	4307	2	Demo #32	https://picsum.photos/seed/p32/600/600	Snacks	2025-10-21 03:10:07.837	2025-11-08 23:23:32.147
52	Cerveza de Arandanos (Bruder)	16000	16000	50	Cerveza artesanal de estilo Fruit Beer, conocida por su sabor refrescante, ligeramente ácido y dulce.	https://picsum.photos/seed/p36/600/600	Cerveza	2025-10-21 03:10:07.837	2025-11-15 02:25:18.309
5	Gato Negro Merlot 750ml	50000	38500	7	Merlot	https://picsum.photos/seed/merlot/600/600	Vino	2025-10-21 03:10:06.522	2025-11-16 01:02:14.932
53	Cerveza de Chocolate (Bruder)	16000	16000	50	Una cerveza negra artesanal colombiana, descrita como la primera de su tipo en Sudamérica, con un alto contenido de alcohol de 8.5%. Su sabor se caracteriza por notas intensas de chocolate combinadas con matices de madera, caramelo y un toque tostado.	https://picsum.photos/seed/p37/600/600	Cerveza	2025-10-21 03:10:07.837	2025-11-15 02:36:02.17
21	Producto 5	1685	1348	9	Demo #5	https://picsum.photos/seed/p5/600/600	Snacks	2025-10-21 03:10:07.837	2025-11-08 23:27:31.151
10	Aguardiente Amarillo de Manzanares x 700	55000	55000	6	Su color era amarillo vibrante como el sol y su sabor fresco y aromático	https://picsum.photos/seed/buchanans/600/600	Aguardiente	2025-10-21 03:10:07.068	2025-11-16 01:02:14.935
56	Producto 40	6480	5184	14	Demo #40	https://picsum.photos/seed/p40/600/600	Whisky	2025-10-21 03:10:07.837	2025-10-23 05:21:41.377
31	Producto 15	3055	2444	12	Demo #15	https://picsum.photos/seed/p15/600/600	Aseo	2025-10-21 03:10:07.837	2025-10-24 00:25:29.171
36	Producto 20	3740	2992	23	Demo #20	https://picsum.photos/seed/p20/600/600	Ron	2025-10-21 03:10:07.837	2025-11-10 06:01:11.441
4	Concha y Toro Reservado Cabernet 750ml	42000	33600	14	Cabernet	https://picsum.photos/seed/cabernet/600/600	Vino	2025-10-21 03:10:06.413	2025-11-11 04:23:44.892
39	Producto 23	4151	3321	21	Demo #23	https://picsum.photos/seed/p23/600/600	Snacks	2025-10-21 03:10:07.837	2025-10-29 20:30:05.785
57	Producto 41	6617	5294	9	Demo #41	https://picsum.photos/seed/p41/600/600	Snacks	2025-10-21 03:10:07.837	2025-11-13 13:32:40.682
12	Maní La Especial 100g	3500	2800	142	Snack	https://picsum.photos/seed/mani/600/600	Snacks	2025-10-21 03:10:07.283	2025-11-13 13:50:31.068
32	Producto 16	3192	2554	15	Demo #16	https://picsum.photos/seed/p16/600/600	Vodka	2025-10-21 03:10:07.837	2025-10-29 20:30:05.792
58	Producto 42	6754	5403	14	Demo #42	https://picsum.photos/seed/p42/600/600	Aseo	2025-10-21 03:10:07.837	2025-10-29 20:30:05.794
11	Aguila Bandeja	72000	72000	160	Cerveza lager	https://picsum.photos/seed/margarita/600/600	Cerveza	2025-10-21 03:10:07.178	2025-11-16 01:02:14.937
23	Producto 7	1959	1567	11	Demo #7	https://picsum.photos/seed/p7/600/600	Vodka	2025-10-21 03:10:07.837	2025-10-29 20:30:05.798
40	Producto 24	4288	3430	23	Demo #24	https://picsum.photos/seed/p24/600/600	Aseo	2025-10-21 03:10:07.837	2025-11-09 05:24:27.768
47	Producto 31	5247	4198	3	Demo #31	https://picsum.photos/seed/p31/600/600	Whisky	2025-10-21 03:10:07.837	2025-11-08 16:06:24.984
43	Producto 27	4699	3759	24	Demo #27	https://picsum.photos/seed/p27/600/600	Cerveza	2025-10-21 03:10:07.837	2025-11-05 22:22:44.947
46	Producto 30	5110	4088	2	Demo #30	https://picsum.photos/seed/p30/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-11-08 16:06:24.987
49	Producto 33	5521	4417	7	Demo #33	https://picsum.photos/seed/p33/600/600	Aseo	2025-10-21 03:10:07.837	2025-11-08 16:06:24.988
44	Producto 28	4836	3869	32	Demo #28	https://picsum.photos/seed/p28/600/600	Vino	2025-10-21 03:10:07.837	2025-11-09 05:24:27.771
60	Producto 44	7028	5622	15	Demo #44	https://picsum.photos/seed/p44/600/600	Tequila	2025-10-21 03:10:07.837	2025-11-10 00:39:12.099
14	Coronita Sixpac	18000	18000	70	cerveza tipo Pale Lager de origen mexicano, conocida por su sabor suave, refrescante y ligeramente afrutado	https://picsum.photos/seed/suavitel/600/600	Cerveza	2025-10-21 03:10:07.499	2025-11-15 01:52:20.522
22	Producto 6	1822	1458	2	Demo #6	https://picsum.photos/seed/p6/600/600	Aseo	2025-10-21 03:10:07.837	2025-11-09 18:27:48.969
38	Producto 22	4014	3211	12	Demo #22	https://picsum.photos/seed/p22/600/600	Whisky	2025-10-21 03:10:07.837	2025-11-09 18:27:48.973
26	Producto 10	2370	1896	11	Demo #10	https://picsum.photos/seed/p10/600/600	Vino	2025-10-21 03:10:07.837	2025-11-10 04:05:26.295
42	Producto 26	4562	3650	28	Demo #26	https://picsum.photos/seed/p26/600/600	Tequila	2025-10-21 03:10:07.837	2025-11-11 02:08:32.217
61	Producto 45	7165	5732	20	Demo #45	https://picsum.photos/seed/p45/600/600	Cerveza	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
62	Producto 46	7302	5842	21	Demo #46	https://picsum.photos/seed/p46/600/600	Vino	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
63	Producto 47	7439	5951	22	Demo #47	https://picsum.photos/seed/p47/600/600	Ron	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
64	Producto 48	7576	6061	23	Demo #48	https://picsum.photos/seed/p48/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
65	Producto 49	7713	6170	24	Demo #49	https://picsum.photos/seed/p49/600/600	Whisky	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
66	Producto 50	7850	6280	25	Demo #50	https://picsum.photos/seed/p50/600/600	Snacks	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
67	Producto 51	7987	6390	26	Demo #51	https://picsum.photos/seed/p51/600/600	Aseo	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
68	Producto 52	8124	6499	27	Demo #52	https://picsum.photos/seed/p52/600/600	Vodka	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
69	Producto 53	8261	6609	28	Demo #53	https://picsum.photos/seed/p53/600/600	Tequila	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
70	Producto 54	8398	6718	29	Demo #54	https://picsum.photos/seed/p54/600/600	Cerveza	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
71	Producto 55	8535	6828	30	Demo #55	https://picsum.photos/seed/p55/600/600	Vino	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
72	Producto 56	8672	6938	31	Demo #56	https://picsum.photos/seed/p56/600/600	Ron	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
73	Producto 57	8809	7047	32	Demo #57	https://picsum.photos/seed/p57/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
74	Producto 58	8946	7157	33	Demo #58	https://picsum.photos/seed/p58/600/600	Whisky	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
75	Producto 59	9083	7266	34	Demo #59	https://picsum.photos/seed/p59/600/600	Snacks	2025-10-21 03:10:07.837	2025-10-21 03:10:07.837
34	Producto 18	3466	2773	17	Demo #18	https://picsum.photos/seed/p18/600/600	Cerveza	2025-10-21 03:10:07.837	2025-10-21 03:43:08.585
29	Producto 13	2781	2225	12	Demo #13	https://picsum.photos/seed/p13/600/600	Whisky	2025-10-21 03:10:07.837	2025-10-21 03:43:08.806
35	Producto 19	3603	2882	19	Demo #19	https://picsum.photos/seed/p19/600/600	Vino	2025-10-21 03:10:07.837	2025-10-21 03:43:08.908
30	Producto 14	2918	2334	16	Demo #14	https://picsum.photos/seed/p14/600/600	Snacks	2025-10-21 03:10:07.837	2025-10-21 03:43:09.011
37	Producto 21	3877	3102	25	Demo #21	https://picsum.photos/seed/p21/600/600	Aguardiente	2025-10-21 03:10:07.837	2025-10-23 04:04:22.709
41	Producto 25	4425	3540	29	Demo #25	https://picsum.photos/seed/p25/600/600	Vodka	2025-10-21 03:10:07.837	2025-10-23 04:04:22.813
45	Producto 29	4973	3978	33	Demo #29	https://picsum.photos/seed/p29/600/600	Ron	2025-10-21 03:10:07.837	2025-10-23 04:04:22.915
27	Producto 11	2507	2006	15	Demo #11	https://picsum.photos/seed/p11/600/600	Ron	2025-10-21 03:10:07.837	2025-10-23 04:04:23.017
24	Producto 8	2096	1677	10	Demo #8	https://picsum.photos/seed/p8/600/600	Tequila	2025-10-21 03:10:07.837	2025-10-23 04:04:23.12
76	Producto 60	9220	7376	4	Demo #60	https://picsum.photos/seed/p60/600/600	Aseo	2025-10-21 03:10:07.837	2025-10-23 04:05:54.376
20	Vaso de Whiskey	30000	30000	30	vaso de Whiskey de Cristal	https://picsum.photos/seed/p4/600/600	Cristaleria	2025-10-21 03:10:07.837	2025-11-15 02:59:45.831
1	Club Colombia Dorada 330ml	4500	3600	96	Cerveza dorada	https://picsum.photos/seed/club/600/600	Cerveza	2025-10-21 03:10:05.973	2025-11-09 22:38:53.53
13	Detergente Ariel 1kg	12000	9600	79	Aseo	https://picsum.photos/seed/ariel/600/600	Aseo	2025-10-21 03:10:07.394	2025-11-04 05:14:22.727
15	Vodka Absolut 750ml	98000	78400	33	Vodka sueco premium	https://picsum.photos/seed/absolut/600/600	Vodka	2025-10-21 03:10:07.612	2025-11-04 05:14:22.73
1009	Whiskey + Vaso	180000	180000	8	promo	https://picsum.photos/seed/p30/600/600	Combo	2025-11-02 05:56:03.582	2025-11-16 01:02:14.923
17	Andina 269 x Sixpac	15000	15000	15	una cerveza tipo lager con un color dorado intenso. Su sabor es balanceado, con buen cuerpo y amargo equilibrado. Es muy refrescante, suave en la boca y fácil de tomar.	https://picsum.photos/seed/p1/600/600	Cerveza	2025-10-21 03:10:07.837	2025-11-16 01:02:14.939
8	Aguardiente Antioqueño sin azúcar 750ml	48000	38400	28	Sin azúcar	https://picsum.photos/seed/antioqueno/600/600	Aguardiente	2025-10-21 03:10:06.852	2025-11-08 19:53:20.507
2	Poker Lata 330ml	3500	3000	84	Cerveza lager	https://picsum.photos/seed/poker/600/600	Cerveza	2025-10-21 03:10:06.195	2025-11-13 04:46:27.013
16	Tequila José Cuervo 750ml	120000	96000	10	Tequila reposado	https://picsum.photos/seed/cuervo/600/600	Tequila	2025-10-21 03:10:07.721	2025-11-14 01:15:10.878
9	Old Parr 12 750ml	135000	108000	11	Whisky de sabor suave, que combina las notas terrosas de Islay, la sedosidad equilibrada de las aguas de Speyside y la calidez del roble de Cragganmore	https://picsum.photos/seed/oldparr/600/600	Whisky	2025-10-21 03:10:06.961	2025-11-15 01:42:30.027
1003	Combo Paga 2 Lleva 3	15000	15000	3	Combo Aguila	https://picsum.photos/seed/club/600/600	Combo	2025-11-02 03:57:40.786	2025-11-09 20:24:24.455
18	Buchanans x 700 ml	180000	180000	20	whisky escocés blended (mezcla de whiskies de malta y grano) de 12 años, con un color dorado y un sabor suave y afrutado.	https://picsum.photos/seed/p2/600/600	Whisky	2025-10-21 03:10:07.837	2025-11-04 05:14:22.728
6	Ron Medellín Añejo 750ml	56000	44800	23	Añejo	https://picsum.photos/seed/medellin/600/600	Ron	2025-10-21 03:10:06.636	2025-11-10 21:40:18.802
\.


--
-- Data for Name: Promotion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Promotion" (id, name, type, audience, active, stacking, priority, "startsAt", "endsAt", "conditionsJson", "benefitsJson", "createdAt", "updatedAt") FROM stdin;
cmhh3wvzr0002pj0ct5smcbh1	Whisky + Vaso de regalo	GIFT_WITH_PURCHASE	B2C	f	f	95	2025-11-02 02:38:27.637	2025-11-04 02:43:27.637	\N	{"bundleId": "1002", "components": [{"qty": 1, "productId": "50"}, {"qty": 1, "productId": "99"}], "triggerQty": 1, "giftProductId": "99", "triggerProductId": "50"}	2025-11-02 02:43:28.119	2025-11-15 02:44:54.858
cmhhx3xth0000p60c8bxu72jr	Test límite	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 16:20:20.035	2025-11-03 16:20:20.035	{"metadata": {"bannerKey": "slotC"}}	{"price": 5000}	2025-11-02 16:20:45.94	2025-11-15 02:44:36.24
cmhzoqhns0002p901h4za9o80	Gato Negro Merlot x 750	PRICE_OVERRIDE	B2C	t	f	100	2025-11-15 02:42:38.94	2025-12-01 02:42:38.94	\N	{"price": 50000}	2025-11-15 02:46:12.711	2025-11-15 02:46:12.711
cmhzp8hus0004p90129g6oo3x	Whiskey + Vaso	GIFT_WITH_PURCHASE	B2C	t	f	100	2025-11-15 02:47:10.733	2025-11-16 02:47:10.733	\N	{"bundleId": "1009", "triggerQty": 1, "giftProductId": "20", "triggerProductId": "18"}	2025-11-15 03:00:12.773	2025-11-15 03:00:12.773
cmhhcfcmv000dpj0c4a7f06x9	Regalo whiskey vaso	X_FOR_Y	B2C	f	f	100	2025-11-02 06:41:01.218	2025-11-03 06:41:01.218	{"metadata": {"bannerKey": "slotB"}}	{"x": 3, "y": 2, "bundleId": "1009"}	2025-11-02 06:41:46.423	2025-11-15 02:44:38.539
cmhk4yqv80000oc0cigsub2cw	Test de Regalo	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-04 05:35:31.882	2025-11-05 05:35:31.882	{"metadata": {"bannerKey": "slotC"}}	{"bundleId": "1009", "triggerQty": 1, "giftProductId": "5", "triggerProductId": "3"}	2025-11-04 05:36:12.932	2025-11-15 02:44:42.339
cmhhce3pv000bpj0c0kcnna2q	Gato negro barato	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 06:39:22.246	2025-11-03 06:39:22.246	{"metadata": {"bannerKey": "slotA"}}	{"price": 30000}	2025-11-02 06:40:48.21	2025-11-15 02:44:43.651
cmhhbwums0009pj0chza2911b	Hamburguesa	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 06:27:06.629	2025-11-03 06:27:06.629	{"metadata": {"bannerKey": "slotA"}}	{"price": 5000}	2025-11-02 06:27:23.284	2025-11-15 02:44:45.007
cmhh6x4eu0007pj0cyw6atp5v	Test	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-02 04:06:46.797	2025-11-03 04:06:46.797	{"metadata": {"bannerKey": "slotB"}}	{"bundleId": "1009", "triggerQty": 1, "giftProductId": "99", "triggerProductId": "50"}	2025-11-02 04:07:37.878	2025-11-15 02:44:47.02
cmhh6lqt50003pj0c6nbx83ac	Paga 2 x 3	X_FOR_Y	B2C	f	f	100	2025-11-02 03:54:12.253	2025-11-03 03:54:12.253	{"metadata": {"bannerKey": "slotA"}}	{"x": 4, "y": 3, "bundleId": "1003", "components": [{"qty": 6, "productId": "6"}]}	2025-11-02 03:58:47.034	2025-11-15 02:44:48.336
cmhgvk99u0002qt0ccagb0yqv	Test 2 con cambios	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 02:46:13	2025-11-03 02:46:13	{"metadata": {"bannerKey": "slotC"}}	{"price": 2000}	2025-11-01 22:49:41.802	2025-11-15 02:44:49.888
cmhh3wvi30000pj0ctasw2ic6	Combo 3x2 Cerveza	X_FOR_Y	B2C	f	f	90	2025-11-02 02:38:11.741	2025-11-04 02:43:11.745	\N	{"x": 3, "y": 2, "bundleId": "1001", "components": [{"qty": 3, "productId": "3"}]}	2025-11-02 02:43:27.484	2025-11-15 02:44:09.541
cmhlcx4va0000nz0c9r72flyy	Regalo + Vaso Whos	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-05 02:05:29.671	2025-11-06 02:05:29.671	\N	{"bundleId": "1009", "triggerQty": 1, "giftProductId": "1", "triggerProductId": "1"}	2025-11-05 02:06:40.87	2025-11-15 02:44:23.766
cmhk51b1o0002oc0c24q4ufcz	Test de regalo	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-04 05:37:25.3	2025-11-05 05:37:25.3	{"metadata": {"bannerKey": "slotC"}}	{"bundleId": "1009", "triggerQty": 2, "giftProductId": "5", "triggerProductId": "3"}	2025-11-04 05:38:12.396	2025-11-15 02:44:25.553
cmhk5vmok0004oc0c4nhrp4ty	Cerveza baratísima	PRICE_OVERRIDE	B2C	f	f	100	2025-11-04 06:00:50.723	2025-11-05 06:00:50.723	\N	{"price": 3500}	2025-11-04 06:01:47.156	2025-11-15 02:44:27.205
cmhhxcgyo000cp60c9sqix212	Vino a 15.000 gato negro	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 16:27:02.91	2025-11-03 16:27:02.91	{"metadata": {"bannerKey": "slotA"}}	{"price": 15000}	2025-11-02 16:27:23.998	2025-11-15 02:44:28.6
cmhhx885f0008p60ckw0m5556	Gato negro a 30000	PRICE_OVERRIDE	B2C	f	f	100	2025-11-02 16:23:13.507	2025-11-03 16:23:13.507	{"metadata": {"bannerKey": "slotA"}}	{"price": 30000}	2025-11-02 16:24:05.954	2025-11-15 02:44:30.246
cmhhx9wda000ap60cxoay4e0p	Whiskey + Vaso	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-02 16:23:13.507	2025-11-03 16:23:13.507	{"metadata": {"bannerKey": "slotB"}}	{"bundleId": "1009", "triggerQty": 1, "giftProductId": "50", "triggerProductId": "1009"}	2025-11-02 16:25:23.999	2025-11-15 02:44:32.057
cmhhx4bob0002p60czaxpc7eh	Test límite 2	PERCENT_OFF	B2C	f	f	100	2025-11-02 16:20:20.035	2025-11-03 16:20:20.035	{"metadata": {"bannerKey": "slotC"}}	{"percent": 10}	2025-11-02 16:21:03.896	2025-11-15 02:44:33.437
cmhhx5sco0006p60cwpoied7x	Test 4 sin límites	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-02 16:20:20.035	2025-11-03 16:20:20.035	\N	{"bundleId": "1011", "triggerQty": 1, "giftProductId": "99", "triggerProductId": "1011"}	2025-11-02 16:22:12.168	2025-11-15 02:44:35.054
cmhh6vsje0005pj0cv5q8qzib	Chivas + hat	GIFT_WITH_PURCHASE	B2C	f	f	100	2025-11-02 04:04:28.079	2025-11-03 04:04:28.079	{"metadata": {"bannerKey": "slotB"}}	{"bundleId": "1004", "components": [{"qty": 1, "productId": "50"}], "triggerQty": 1, "giftProductId": "99", "triggerProductId": "50"}	2025-11-02 04:06:35.835	2025-11-15 02:44:51.806
cmhhx51r60004p60cev6godr5	Test límite	X_FOR_Y	B2C	f	f	100	2025-11-02 16:20:20.035	2025-11-03 16:20:20.035	\N	{"x": 5, "y": 2, "bundleId": "1010"}	2025-11-02 16:21:37.698	2025-11-15 02:44:53.226
\.


--
-- Data for Name: PromotionProduct; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PromotionProduct" (id, "promotionId", "minQty", "productId") FROM stdin;
cmhzoqhns0003p90152g4eipq	cmhzoqhns0002p901h4za9o80	\N	5
cmhzp8hut0005p9015brpllmj	cmhzp8hus0004p90129g6oo3x	\N	1009
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, phone, password, role, "isPhoneVerified", "isEmailVerified", "otpCodeHash", "otpExpiresAt", "lastOtpSentAt", "createdAt", "updatedAt", "adminProcessStatus", "businessVerificationStatus", "deletedAt") FROM stdin;
4	Cliente	\N	+573204563914	\N	B2C	f	f	92bd25e58620e2c5:6c59c21d25cc6ac8968ecedd8ec00181b81c177a96efd04ed9aa542ae27c9933	2025-10-21 03:39:28.248	2025-10-21 03:29:28.248	2025-10-21 03:28:40.893	2025-10-21 03:29:28.251	PENDING	NONE	\N
89	Cuenta eliminada	\N	\N	\N	B2C	f	f	\N	\N	\N	2025-11-14 00:56:37.142	2025-11-14 02:41:37.275	PENDING	NONE	2025-11-14 02:41:37.272
2	Motorolla	exito@exito.com	+573053233975	\N	B2C	t	f	\N	\N	2025-11-13 19:51:53.902	2025-10-21 03:10:04.272	2025-11-13 19:52:08.432	PENDING	NONE	\N
90	Licoexpress	licoartesanias@hotmail.com	+573115026310	\N	B2C	t	f	\N	\N	2025-11-14 21:56:46.53	2025-11-14 02:42:31.467	2025-11-14 21:57:00.166	PENDING	NONE	\N
1	Iphone	expo@admin.com	+573505336910	\N	ADMIN	t	f	\N	\N	2025-11-16 01:01:12.925	2025-10-21 03:30:28.063	2025-11-16 01:01:21.052	ATTENDED	REJECTED	\N
3	BlueStacks	expolicores@outlook.com	+573219077404	\N	B2C	t	f	\N	\N	2025-11-16 02:06:00.422	2025-10-21 03:10:04.487	2025-11-16 02:07:51.75	PENDING	NONE	\N
7	Admin Expolicores	admin@expolicores.com	+573000000000	$2b$10$44ztLu1PA710AYhXb9gkI.rIg3ppapWhyBTXNV9QJCFViXZRMmqji	ADMIN	f	t	\N	\N	\N	2025-10-21 03:10:04.057	2025-11-01 16:40:08.871	PENDING	NONE	\N
\.


--
-- Data for Name: UserPushToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserPushToken" (id, "userId", token, platform, "lastUsedAt", "createdAt", "updatedAt") FROM stdin;
cmhtt9z8x0001vl01qsihhvoy	1	ExponentPushToken[5a0B-HE35Xr97KGqzzQUmd]	ios	2025-11-11 03:07:18.004	2025-11-11 00:06:43.378	2025-11-11 03:07:18.005
cmhqgzlh30001pk010m2xgar5	3	ExponentPushToken[gkL1CHGdFRbOHDln6u5jmR]	android	2025-11-08 15:59:25.047	2025-11-08 15:59:25.048	2025-11-08 15:59:25.048
cmhwuhd4n0001rn01hbvn7qpg	3	ExponentPushToken[SIMULADO123456]	android	2025-11-13 03:06:26.135	2025-11-13 03:03:46.104	2025-11-13 03:06:26.136
cmhwy5n6y0001k901ybf4wkf7	2	ExponentPushToken[0XEvFHDHwJTSUEPl18rfGH]	android	2025-11-13 04:46:37.737	2025-11-13 04:46:37.739	2025-11-13 04:46:37.739
cmhqh63qn0003pk01mbde250p	1	ExponentPushToken[fr-4snKMpxguhWMk2MKhcA]	ios	2025-11-08 23:39:03.326	2025-11-08 16:04:28.655	2025-11-08 23:39:03.327
cmhzfi3ej0001p901g2zv1ez6	90	ExponentPushToken[wVxmcBCFHo6s2TTxftc1bA]	android	2025-11-15 03:14:30.585	2025-11-14 22:27:44.444	2025-11-15 03:14:30.586
cmhmh2h6m0001ph0czioukb5n	1	ExponentPushToken[loc7nELuNSW4fFu7-OksYo]	ios	2025-11-16 01:02:18.022	2025-11-05 20:50:34.75	2025-11-16 01:02:18.023
cmhsmd5ur0001my018phlpxcc	1	ExponentPushToken[tA1B7AFim3fO2iL8fPyjSi]	ios	2025-11-10 21:40:19.372	2025-11-10 04:05:28.419	2025-11-10 21:40:19.373
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
308827c0-a224-49e7-9525-99f3b76b90da	afc07a0129b10f7d269bdaa110bb34166ec29db03b05c91dbd908fabc6f87f75	2025-10-21 02:06:01.367166+00	20251012204407_0000_baseline	\N	\N	2025-10-21 02:06:00.609002+00	1
a3bfa2e7-a7d8-41c0-96ac-4f589ebe2414	081dc9fdfeaf7892e42ab274c275e4fa1a19589bda68ccb33d804eaf61fcfc67	2025-10-21 02:06:02.063869+00	20251016001715_waba_go_live	\N	\N	2025-10-21 02:06:01.561921+00	1
df161813-74ef-49fe-a7b8-7b0259eb7826	f46d6f40c873982fd58878bde0267030e8db27ea2e8630424fb090230b3bfa60	2025-10-21 02:06:02.753706+00	20251021014322_role_add_b2b_values	\N	\N	2025-10-21 02:06:02.259585+00	1
d21203f9-9cdd-49d2-8fdb-c01b3810d79c	89acd8a9b781e46b8cf07706438dced60c47b85d2ab8ce8754e56fe33618a319	2025-10-21 02:06:03.468032+00	20251021015050_role_drop_legacy_values	\N	\N	2025-10-21 02:06:02.946236+00	1
43517f5e-4da8-4e3a-8bc7-30d3f391f22b	fd5a73bd3515a038773fd0ad4c6f9429232d8f0be9c7b3fd2f005974900cbc77	2025-11-07 03:09:31.276856+00	20251107030648_promo_prod_reset_int_final	\N	\N	2025-11-07 03:09:30.755539+00	1
98c02c8f-4af3-4dad-93c6-a8d68f80fe41	4aedb0e796f3a3739c16ba7c946e011eeb8522348f1a123a17fa7dc1e9333b5f	2025-10-21 03:08:19.945354+00	20251021030818_user_add_b2b_statuses	\N	\N	2025-10-21 03:08:19.180734+00	1
7505fc00-f77d-499c-be19-8f6524aaff19	1f3e4f4032535f08a970c168c6b78b061ac12ae458dee5c660ff1a90b8c09cd0	2025-10-24 00:05:23.142073+00	20251024000522_add_user_push_tokens	\N	\N	2025-10-24 00:05:22.545262+00	1
b252a6e8-0d4b-4238-b6b1-9f5a53c0252f	8673847ff8e18a8ff0afb7b8c1dd931af7ed9a6b54847156a2d9584f69a1aa7d	2025-11-07 02:38:37.077625+00	20251107020804_fix_promotionproduct_productid_int	\N	\N	2025-11-07 02:38:36.524628+00	1
a52aa4cb-7803-4034-945f-93bab429550f	d124952d6acb3b275d6eb30a0b37d3b7336e846fe33224f07781fb03b5fee28d	2025-10-31 00:17:33.492982+00	20251031001732_promotions_f1	\N	\N	2025-10-31 00:17:32.92205+00	1
cdcb9897-fc09-4680-b5cd-6fa6b83c2398	a09abc74cc6a48082b8a818199a9455bfdc57a8b79a5be096b91a41903be56a5	2025-11-02 02:11:10.786891+00	20251102021109_add_bundle_map	\N	\N	2025-11-02 02:11:10.26228+00	1
5c231880-014e-4e59-aada-210359821f3e	20ba1ea56de97d2bf8e86f41dde5c2ae50cc5d5a4cd0ecab3acbcc86576e79fd	2025-11-07 03:10:47.255192+00	20251107031046_promo_prod_backref_finalize	\N	\N	2025-11-07 03:10:46.723902+00	1
c91c8d41-ebd9-4ab1-ae8b-07f1ae073b79	628684eae3776ae1e196229456b7270d738251e627e6a91fbb6fec8b0df05950	2025-11-09 17:25:48.55659+00	20251109172547_cascade_order_children	\N	\N	2025-11-09 17:25:48.014539+00	1
080b05c1-8f9b-4fdf-a874-0e7e31af9e79	efe73091f9e9e261c0aa6ff4ba2202913d6014b5239d2a5f23cf3f3eabb5e480	2025-11-14 02:22:52.685941+00	20251114022251_add_user_deleted_at	\N	\N	2025-11-14 02:22:52.15795+00	1
\.


--
-- Data for Name: Address; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."Address" (id, "userId", label, recipient, phone, line1, line2, neighborhood, city, state, country, lat, lng, notes, "isDefault", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Favorite; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."Favorite" (id, "userId", "productId", "createdAt") FROM stdin;
\.


--
-- Data for Name: IdempotencyKey; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."IdempotencyKey" (key, "orderId", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: NotificationLog; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."NotificationLog" (id, "orderId", type, "to", sid, ok, error, "createdAt", channel) FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."Order" (id, "createdAt", "userId", total, status, "updatedAt") FROM stdin;
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."OrderItem" (id, "orderId", "productId", quantity) FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."Product" (id, name, description, price, "createdAt", "updatedAt", stock, category, "imageUrl", "b2bPrice") FROM stdin;
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."RefreshToken" (id, "userId", "tokenHash", "expiresAt", "revokedAt", "replacedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: shadow_prisma; Owner: postgres
--

COPY shadow_prisma."User" (id, email, password, "createdAt", "updatedAt", name, phone, role, "emailAlt") FROM stdin;
\.


--
-- Name: Address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Address_id_seq"', 10, true);


--
-- Name: EmailVerificationToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."EmailVerificationToken_id_seq"', 4, true);


--
-- Name: Favorite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Favorite_id_seq"', 24, true);


--
-- Name: NotificationLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."NotificationLog_id_seq"', 349, true);


--
-- Name: OrderItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."OrderItem_id_seq"', 192, true);


--
-- Name: OrderLiveActivity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."OrderLiveActivity_id_seq"', 1, false);


--
-- Name: Order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Order_id_seq"', 103, true);


--
-- Name: Product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Product_id_seq"', 76, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 95, true);


--
-- Name: Address_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."Address_id_seq"', 1, false);


--
-- Name: Favorite_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."Favorite_id_seq"', 1, false);


--
-- Name: NotificationLog_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."NotificationLog_id_seq"', 1, false);


--
-- Name: OrderItem_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."OrderItem_id_seq"', 1, false);


--
-- Name: Order_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."Order_id_seq"', 1, false);


--
-- Name: Product_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."Product_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: shadow_prisma; Owner: postgres
--

SELECT pg_catalog.setval('shadow_prisma."User_id_seq"', 1, false);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: BundleMap BundleMap_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BundleMap"
    ADD CONSTRAINT "BundleMap_pkey" PRIMARY KEY ("bundleId");


--
-- Name: EmailOtp EmailOtp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailOtp"
    ADD CONSTRAINT "EmailOtp_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerificationToken EmailVerificationToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY (id);


--
-- Name: Favorite Favorite_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY (id);


--
-- Name: IdempotencyKey IdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY (key);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: OrderLiveActivity OrderLiveActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderLiveActivity"
    ADD CONSTRAINT "OrderLiveActivity_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: PromotionProduct PromotionProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY (id);


--
-- Name: Promotion Promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Promotion"
    ADD CONSTRAINT "Promotion_pkey" PRIMARY KEY (id);


--
-- Name: UserPushToken UserPushToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserPushToken"
    ADD CONSTRAINT "UserPushToken_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: Favorite Favorite_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Favorite"
    ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY (id);


--
-- Name: IdempotencyKey IdempotencyKey_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY (key);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: EmailOtp_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "EmailOtp_email_idx" ON public."EmailOtp" USING btree (email);


--
-- Name: EmailOtp_requestIp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "EmailOtp_requestIp_idx" ON public."EmailOtp" USING btree ("requestIp");


--
-- Name: EmailVerificationToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON public."EmailVerificationToken" USING btree ("expiresAt");


--
-- Name: EmailVerificationToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON public."EmailVerificationToken" USING btree (token);


--
-- Name: Favorite_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Favorite_productId_idx" ON public."Favorite" USING btree ("productId");


--
-- Name: Favorite_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Favorite_userId_idx" ON public."Favorite" USING btree ("userId");


--
-- Name: Favorite_userId_productId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON public."Favorite" USING btree ("userId", "productId");


--
-- Name: IdempotencyKey_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IdempotencyKey_createdAt_idx" ON public."IdempotencyKey" USING btree ("createdAt");


--
-- Name: IdempotencyKey_status_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IdempotencyKey_status_createdAt_idx" ON public."IdempotencyKey" USING btree (status, "createdAt");


--
-- Name: NotificationLog_messageSid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_messageSid_idx" ON public."NotificationLog" USING btree ("messageSid");


--
-- Name: OrderLiveActivity_orderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OrderLiveActivity_orderId_key" ON public."OrderLiveActivity" USING btree ("orderId");


--
-- Name: Product_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_category_idx" ON public."Product" USING btree (category);


--
-- Name: PromotionProduct_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PromotionProduct_productId_idx" ON public."PromotionProduct" USING btree ("productId");


--
-- Name: PromotionProduct_productId_int_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PromotionProduct_productId_int_idx" ON public."PromotionProduct" USING btree ("productId");


--
-- Name: PromotionProduct_promotionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PromotionProduct_promotionId_idx" ON public."PromotionProduct" USING btree ("promotionId");


--
-- Name: UserPushToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UserPushToken_token_key" ON public."UserPushToken" USING btree (token);


--
-- Name: UserPushToken_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserPushToken_userId_idx" ON public."UserPushToken" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: orderId_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "orderId_type" ON public."NotificationLog" USING btree ("orderId", type);


--
-- Name: Favorite_productId_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "Favorite_productId_idx" ON shadow_prisma."Favorite" USING btree ("productId");


--
-- Name: Favorite_userId_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "Favorite_userId_idx" ON shadow_prisma."Favorite" USING btree ("userId");


--
-- Name: IdempotencyKey_createdAt_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "IdempotencyKey_createdAt_idx" ON shadow_prisma."IdempotencyKey" USING btree ("createdAt");


--
-- Name: IdempotencyKey_status_createdAt_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "IdempotencyKey_status_createdAt_idx" ON shadow_prisma."IdempotencyKey" USING btree (status, "createdAt");


--
-- Name: NotificationLog_orderId_createdAt_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "NotificationLog_orderId_createdAt_idx" ON shadow_prisma."NotificationLog" USING btree ("orderId", "createdAt");


--
-- Name: NotificationLog_orderId_type_key; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE UNIQUE INDEX "NotificationLog_orderId_type_key" ON shadow_prisma."NotificationLog" USING btree ("orderId", type);


--
-- Name: Product_category_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "Product_category_idx" ON shadow_prisma."Product" USING btree (category);


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE INDEX "RefreshToken_userId_idx" ON shadow_prisma."RefreshToken" USING btree ("userId");


--
-- Name: User_emailAlt_key; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE UNIQUE INDEX "User_emailAlt_key" ON shadow_prisma."User" USING btree ("emailAlt");


--
-- Name: User_email_key; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON shadow_prisma."User" USING btree (email);


--
-- Name: favorite_user_product_unique; Type: INDEX; Schema: shadow_prisma; Owner: postgres
--

CREATE UNIQUE INDEX favorite_user_product_unique ON shadow_prisma."Favorite" USING btree ("userId", "productId");


--
-- Name: Address Address_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmailVerificationToken EmailVerificationToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationLog NotificationLog_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrderLiveActivity OrderLiveActivity_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderLiveActivity"
    ADD CONSTRAINT "OrderLiveActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderLiveActivity OrderLiveActivity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderLiveActivity"
    ADD CONSTRAINT "OrderLiveActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PromotionProduct PromotionProduct_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromotionProduct PromotionProduct_promotionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PromotionProduct"
    ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES public."Promotion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPushToken UserPushToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserPushToken"
    ADD CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Address Address_userId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow_prisma."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Favorite Favorite_productId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Favorite"
    ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow_prisma."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_userId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow_prisma."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationLog NotificationLog_orderId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."NotificationLog"
    ADD CONSTRAINT "NotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES shadow_prisma."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES shadow_prisma."Order"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow_prisma."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow_prisma."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RefreshToken RefreshToken_replacedById_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."RefreshToken"
    ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES shadow_prisma."RefreshToken"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: shadow_prisma; Owner: postgres
--

ALTER TABLE ONLY shadow_prisma."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow_prisma."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict OjUBp2ZNZdhPBm982MPO1ZH0EevyFwmggvahG0zKfbRKP4RGIy77OOktvERK71g

